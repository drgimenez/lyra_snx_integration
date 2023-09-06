//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../Utils.sol";
import "../../../synthetix/IPerpsV2MarketConsolidated_override.sol";

abstract contract SynthetixAdapter is Utils {

    // ---------------------------------------------------------------------------------------------
    // Struct types
    // ---------------------------------------------------------------------------------------------

    struct SynthetixPosition {
        int256 delta;   // Delta size of the position in Sinthetix
        uint256 price;  // Price of the position in Sinthetix
        uint256 margin;  // Margin of the position in Sinthetix
    }

    // ---------------------------------------------------------------------------------------------
    // Contract state variables
    // ---------------------------------------------------------------------------------------------

    IPerpsV2MarketConsolidated_override public futureMarket_ETH;
    address public sUSD_contractAddress;

    // ---------------------------------------------------------------------------------------------
    // Position state
    // ---------------------------------------------------------------------------------------------

    mapping(address => uint256) public marginOf;
    
    /// @notice Asociate the Lyra position with the Sinthetix position
    /// @dev Lyra Position Id => SinthetixPositionId
    mapping(uint256 => SynthetixPosition) public positionSynthetix;

    // ---------------------------------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------------------------------
    constructor(IPerpsV2MarketConsolidated_override _futureMarket_ETH, address _sUSD_contractAddress) {
        futureMarket_ETH = _futureMarket_ETH;
        sUSD_contractAddress = _sUSD_contractAddress;
    }

    // ---------------------------------------------------------------------------------------------
    // Main Functions
    // ---------------------------------------------------------------------------------------------

    function _openPositionSynthetix(int256 _deltaSize, uint256 _positionId) internal returns(bool _success){
        
        // Get the required margin
        uint256 _price;
        (_price, _success) = _financingOperation(_deltaSize);
        if(!_success) { revert FinancingOperationFailed(msg.sender, _deltaSize); }

        // Get the current margin before operation.
        uint256 _marginBefore = _getRemainingMargin();

        // Open ETH future position
        futureMarket_ETH.submitOffchainDelayedOrder(_deltaSize, _price);

        // Get remaining margin
        uint256 _marginAfter = _getRemainingMargin();
        uint256 _consumedMargin = _marginBefore - _marginAfter;
        
        // Store position information
        SynthetixPosition memory _synthetixPosition = SynthetixPosition({
            delta: _deltaSize,
            price: _price,
            margin: _consumedMargin
        });
        positionSynthetix[_positionId] = _synthetixPosition;

        // Update sender margin
        marginOf[msg.sender] -= _consumedMargin;
    }

    /// @notice This function assumes that the owner's address has already been verified. 
    function _cancelPositionSynthetix() internal returns(bool) {
        // This contract account
        address _account = address(this);

        // Get the current margin before the close. When canceling a position the margin is restored
        // The initial margin plus profit and funding; returns zero balance if losses exceed the initial margin
        uint256 _marginBefore = _getRemainingMargin();

        // Cancel ETH future position
        futureMarket_ETH.cancelOffchainDelayedOrder(_account);

        // Get margin after cancel. The diference is property of the sender
        uint256 _marginAfter = _getRemainingMargin();
        
        // Update sender margin
        marginOf[msg.sender] += _marginAfter - _marginBefore;

        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Auxiliar Functions
    // ---------------------------------------------------------------------------------------------

    // Base on the remaingn margin, get the liquidity from the sender
    function _financingOperation(int256 _deltaSize) internal returns(uint256 _price, bool _success){

        // Get price and margin for a delta size
        uint256 _requiredMargin;
        (_price, _requiredMargin, _success) = _getEstimatedPriceAndMargin(_deltaSize);
        if(!_success || _requiredMargin == 0) { revert EstimatedMarginOperationFailed(_deltaSize); }

        // get current margin
        uint256 _remainingMargin = _getRemainingMargin();

        // If the user's account does not have enough margin, increase the margin
        if (_remainingMargin == 0 || _remainingMargin < _requiredMargin) {
            
            // Get approved sUSD from sender
            uint256 _approvedAmount;
            (_success, _approvedAmount) = _getLiquidityFromSender(sUSD_contractAddress);
            if(_success) {
                marginOf[msg.sender] += _approvedAmount;
            }
            
            // Tranfer margin to Synthetix protocol
            futureMarket_ETH.transferMargin(int(_approvedAmount));
        }
    }

    // Get ETH futur contract price
    function _getEstimatedPriceAndMargin(int256 _size) internal view returns(uint256 _price, uint256 _margin, bool _success) {
        // Function fillPrice returns bool invalid, so, true is fail (aka invalid) and false is success
        (_price, _success) = futureMarket_ETH.fillPrice(_size);
        _success = !_success; // Transform negative logic into positive logic
        if(!_success) { revert FillPriceOperationFailed(_size); }

        // Set order type offchain
        // 0:Atomic, 1:Delayed, 2:Offchain
        uint256 _fee;
        IPerpsV2MarketConsolidated_override.OrderType _orderType = IPerpsV2MarketConsolidated_override.OrderType.Offchain;
        
        // Function orderFee returns bool invalid, so, true is fail (aka invalid) and false is success
        (_fee, _success) = futureMarket_ETH.orderFee(_size, _orderType);
        _success = !_success; // Transform negative logic into positive logic
        if(!_success) { revert OrderFeeOperationFailed(_size,_orderType); }

        // Estimate keeper fee 2% of price
        uint256 _keeperFee = _price * 20000000000000000 / 1 ether;

        // Estimate required margin for the operation
        _margin = _price + _fee + _keeperFee;
    }

    function _getRemainingMargin() internal view returns(uint256 _remainingMargin) {
        bool _invalid;
        (_remainingMargin, _invalid) = futureMarket_ETH.remainingMargin(address(this));
        if(_invalid) {
            revert RemainingMarginOperationFailed(address(this));
        }
    }

    // -----------------------------------------------------------------------------------
    // Errors definitions
    // -----------------------------------------------------------------------------------
    error FillPriceOperationFailed(int256 _size);
    error OrderFeeOperationFailed(int256 _size, IPerpsV2MarketConsolidated_override.OrderType _orderType);
    error EstimatedMarginOperationFailed(int256 _size);
    error FinancingOperationFailed(address _account, int256 _deltaSize);
    error RemainingMarginOperationFailed(address _account);
}
