//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./interfaces/IStrands.sol";
import "./abstracts/adapters/LyraAdapter.sol";
import "./abstracts/adapters/SynthetixAdapter.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Strands is ReentrancyGuard, SynthetixAdapter, LyraAdapter, IStrands {    

    // ---------------------------------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------------------------------
    constructor(
        OptionMarket _optionMarket_ETH, 
        IOptionToken _optionToken_ETH, 
        GWAVOracle _gwavOracle,
        IPerpsV2MarketConsolidated_override _futureMarket_ETH, 
        address _sUSD_contractAddress
    )
    LyraAdapter(_optionMarket_ETH, _optionToken_ETH, _gwavOracle)
    SynthetixAdapter(_futureMarket_ETH, _sUSD_contractAddress) 
    {}

    // ---------------------------------------------------------------------------------------------
    // Main Functions
    // ---------------------------------------------------------------------------------------------

    // ---------------------------------------------------------------------------------------------
    /// @notice The function buy a call options on Lyra Protocol and hedge the delta of the options
    /// by shorting equal delta amount of ETH perpetual future on Sinthetix protocol
    /// @dev For instance: Buy 3 call options with call delta 0.5 each
    /// and short 3*0.5 = 1.5 of ETH future against it to make the overall portfolio delta neutral.
    /// @dev Use USDc for trading options on Lyra 
    /// @dev Use sUSD for trading perpetual future on Synthetix
    /// --------------------------------------------------------------------------------------------
    /// @param _strikeId The identification of the strike to buy
    /// @param _amount The amount of options to buy
    /// --------------------------------------------------------------------------------------------
    function buyHedgedCall(uint256 _strikeId, uint256 _amount) external nonReentrant() 
    isValidAmount(_amount)
    isValidStrikeId(_strikeId)
    {
        // ----------------------------------------------------------------------------
        // Open position on Lyra protocol
        // ----------------------------------------------------------------------------
        (bool _success,
        uint256 _positionId,
        int256 _deltaSize) = _openPositionLyra(_strikeId, _amount);

        if(!_success) {
            revert OpenPositionLyraFailed(_strikeId, _amount);
        }

        // ----------------------------------------------------------------------------
        // Open position on Sinthetix protocol
        // ----------------------------------------------------------------------------
        _success = _openPositionSynthetix(_deltaSize, _positionId);

        if(!_success) {
            revert OpenPositionSynthetixFailed(_positionId, _deltaSize);
        }
    }

    // ---------------------------------------------------------------------------------------------
    /// @notice The function buy or sell ETH perpetual future to offset the change in delta of the 
    /// options position. 
    /// @dev The objective is to keep the portfolio delta neutral against movements in the underlying
    /// price that can cause changes in the delta of an option.
    /// @dev Use sUSD for trading perpetual future on Synthetix
    /// --------------------------------------------------------------------------------------------
    /// @param _positionId The identification of the position to re-hedge
    /// --------------------------------------------------------------------------------------------
    function reHedge(uint256 _positionId) external nonReentrant() isValidPosition(_positionId) {
        // Get delta size
        int256 _deltaSize = _getDeltaSizeGWAV(_positionId);

        // Close previous position
        (bool _success) = _cancelPositionSynthetix();

        // Open position on Sinthetix protocol
        _success = _openPositionSynthetix(_deltaSize, _positionId);

        if(!_success) {
            revert OpenPositionSynthetixFailed(_positionId, _deltaSize);
        }

        // Verify the operation recovering the new positions
        //IPerpsV2MarketConsolidated_override.DelayedOrder memory _delayedOrders = futureMarket_ETH.delayedOrders(address(this));
    }

    // ---------------------------------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------------------------------

    modifier isValidStrikeId(uint256 _strikeId) {
        if(_strikeId == 0 || !_isValidStrikeId(_strikeId)) {
            revert InvalidStrikeId(_strikeId);
        }
        _;
    }

    modifier isValidAmount(uint256 _amount) {
        if(_amount == 0) { revert InvalidAmount(_amount); }
        _;
    }

    modifier isValidPosition(uint256 _positionId) {
        if(_positionId == 0 || !_isValidPosition(_positionId)) {
            revert InvalidPosition(_positionId, msg.sender);
        }
        _;
    }
}