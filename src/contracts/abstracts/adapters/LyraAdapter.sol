//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../Utils.sol";
import "../../../lyra_protocol/OptionMarket.sol";
import "../../../lyra_protocol/interfaces/IOptionToken.sol";
import "../../../lyra_protocol/periphery/GWAVOracle.sol";

abstract contract LyraAdapter is Utils {

    // ---------------------------------------------------------------------------------------------
    // Struct types
    // ---------------------------------------------------------------------------------------------

    struct LyraPosition {
        uint256 positionIndex;  // Internal index
        uint256 totalCost;      // Total cost of the position
        uint256 totalFee;       // Total fee of the position
        int256 delta;           // Delta size of the position
        address owner;          // User's address who requested the position
    }

    // ---------------------------------------------------------------------------------------------
    // State variables
    // ---------------------------------------------------------------------------------------------

    OptionMarket public optionMarket_ETH;
    IOptionToken public optionToken_ETH;
    GWAVOracle public gwavOracle;

    // ---------------------------------------------------------------------------------------------
    // Position state
    // ---------------------------------------------------------------------------------------------

    /// @notice Total number of positions opened with this protocol
    uint256 public totalPosition;

    /// @notice Identify each position by internal index
    /// @dev Internal index => Lyra Position Id
    mapping(uint256 => uint256) public positionIndex;

    /// @notice Identify each position with his metadata
    /// @dev Lyra Position Id => LyraPosition
    mapping(uint256 => LyraPosition) public positionLyra;

    // ---------------------------------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------------------------------
    constructor(OptionMarket _optionMarket_ETH, IOptionToken _optionToken_ETH, GWAVOracle _gwavOracle) {
        optionMarket_ETH = _optionMarket_ETH;
        optionToken_ETH = _optionToken_ETH;
        gwavOracle = _gwavOracle;
    }

    // ---------------------------------------------------------------------------------------------
    // Main Functions
    // ---------------------------------------------------------------------------------------------

    function _openPositionLyra(uint256 _strikeId, uint256 _amount) internal returns(bool _success, uint256 _positionId, int256 _deltaSize){
        // Quote asset is USDc Token
        address _USDc_Contract = address(optionMarket_ETH.quoteAsset());
        
        // Get approved USDc from sender
        uint256 _approvedAmount;
        (_success, _approvedAmount) = _getLiquidityFromSender(_USDc_Contract);

        // Approve USDc liquidity to OptionMarket contract
        address _spender = address(optionMarket_ETH);
        _approveLiquidityTo(_USDc_Contract, _spender, _approvedAmount);

        // Open option position and return delta
        (_success, _positionId, _deltaSize) = _createPositionLyra(_strikeId, _amount);
    }

    // ---------------------------------------------------------------------------------------------
    // View Functions
    // ---------------------------------------------------------------------------------------------

    function _getDeltaSizeGWAV(uint256 _positionId) internal view returns(int256 _deltaSize) {
        // Get position
        IOptionToken.PositionWithOwner memory _position = optionToken_ETH.getPositionWithOwner(_positionId);

        // Get delta size
        return _getTotalDeltaGWAV(_position.strikeId, _position.amount);
    }

    // ---------------------------------------------------------------------------------------------
    // Auxiliar functions
    // ---------------------------------------------------------------------------------------------

    // Open position in OptionMarket contract
    function _createPositionLyra(uint256 _strikeId, uint256 _amount) internal returns(bool _success, uint256 _positionId, int256 _deltaSize) {
        // Option type and max cost
        OptionMarket.OptionType _longCall = OptionMarket.OptionType.LONG_CALL;
        uint256 _cost = type(uint).max;
        address _referrer = msg.sender;
        
        // Set option parameters
        OptionMarket.TradeInputParameters memory params = OptionMarket.TradeInputParameters({
            strikeId: _strikeId,    // id of strike (uint)
            positionId: 0,          // OptionToken ERC721 id for position (set to 0 for new positions) (uint)
            iterations: 1,          // number of sub-orders to break order into (reduces slippage) (uint)
            optionType: _longCall,  // type of option to trade (OptionType)
            amount: _amount,        // number of contracts to trade (uint)
            setCollateralTo: 0,     // final amount of collateral to leave in OptionToken position (uint)
            minTotalCost: 0,        // revert trade if totalCost is below this value (uint)
            maxTotalCost: _cost,    // revert trade if totalCost is below this value (uint)
            referrer: _referrer     // referrer emitted in Trade event, no on-chain interaction (address)
        });

        // Open position
        OptionMarket.Result memory _result = optionMarket_ETH.openPosition(params);

        // Check reception of the option NFT
        IOptionToken.PositionWithOwner memory _position = optionToken_ETH.getPositionWithOwner(_result.positionId);
        if(_position.state == IOptionToken.PositionState.ACTIVE && _position.owner == address(this)) { 
            // Operation success.
            
            // New position information
            _deltaSize = _getTotalDeltaGWAV(_strikeId, _amount);
            totalPosition++;            
            LyraPosition memory _newPosition = LyraPosition({
                positionIndex: totalPosition,
                totalCost: _result.totalCost,
                totalFee: _result.totalFee,
                delta: _deltaSize,
                owner: msg.sender
            });
            
            // Store new position information
            _positionId = _result.positionId;
            positionIndex[totalPosition] = _result.positionId;
            positionLyra[_positionId] = _newPosition;
            _success = true; 
        }
        else {
            // Operation failed
            revert OpenPositionFailed(
                params.strikeId, 
                params.positionId, 
                params.iterations, 
                params.optionType,
                params.amount, 
                params.setCollateralTo,
                params.minTotalCost,
                params.maxTotalCost,
                params.referrer
            );
        }
    }

    // Get option's delta
    function _getTotalDeltaGWAV(uint256 _strikeId, uint256 _amount) internal view returns(int256 _totalDelta) {
        uint256 _secondsAgo = 0;
        _totalDelta = gwavOracle.deltaGWAV(_strikeId, _secondsAgo);

        if(_amount > 1) {
            _totalDelta = _totalDelta * int256(_amount);
        }
    }

    function _isValidStrikeId(uint256 _strikeId) internal view returns(bool _isValid){
        OptionMarket.Strike memory _strike = optionMarket_ETH.getStrike(_strikeId);
        return _strike.boardId > 0 && _strike.strikePrice > 0;
    }
    
    function _isValidPosition(uint256 _positionId) internal view returns(bool _isValid) {
        // Get position
        try optionToken_ETH.getPositionWithOwner(_positionId) returns (IOptionToken.PositionWithOwner memory _position) {
            // Position states: 0:EMPTY, 1:ACTIVE, 2:CLOSED, 3:LIQUIDATED, 4:SETTLED, 5:MERGED
            return _position.positionId > 0
                && _position.owner == address(this) 
                && _position.state == IOptionToken.PositionState.ACTIVE;
        }
        catch {
            return false;
        }
    }

    // -----------------------------------------------------------------------------------
    // Errors definitions
    // -----------------------------------------------------------------------------------
    error OpenPositionFailed(
        uint256 _strikeId, 
        uint256 _positionId, 
        uint256 _iterations, 
        OptionMarket.OptionType _optionType,
        uint256 _amount, 
        uint256 _setCollateralTo,
        uint256 _minTotalCost,
        uint256 _maxTotalCost,
        address _referrer
    );
}
