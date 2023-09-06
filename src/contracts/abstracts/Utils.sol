//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../../lyra_protocol/interfaces/IERC20Decimals.sol";

abstract contract Utils {

    // -----------------------------------------------------------------------------------
    // Internal functions
    // -----------------------------------------------------------------------------------

    // Get liquidity from sender
    function _getLiquidityFromSender(address _erc20Asset) internal returns(bool _success, uint256 _approvedAmount) {
        // Set owner and spender variables
        address _owner = msg.sender; 
        address _spender = address(this);

        // Check liquidity before trasnfer
        uint256 _quoteAssetBalanceBefore = IERC20Decimals(_erc20Asset).balanceOf(_spender);

        // Get the liquidity amount approved by the sender
        _approvedAmount = IERC20Decimals(_erc20Asset).allowance(_owner, _spender);
        if (_approvedAmount == 0) { revert NoApprovedLiquidity(_erc20Asset, _owner ,_spender); }

        // Transfer approved liquidity from sender balance to spender balance
        _success = IERC20Decimals(_erc20Asset).transferFrom(_owner, _spender, _approvedAmount);
        
        // Check liquidity trasnfer
        uint256 _quoteAssetBalance = IERC20Decimals(_erc20Asset).balanceOf(_spender);
        if(!_success || _quoteAssetBalance != _quoteAssetBalanceBefore + _approvedAmount) {
            revert TransferLiquidityFailed(_erc20Asset, _owner, _spender, _approvedAmount);
        }
    }

    // Approve liquidity to a protocol
    function _approveLiquidityTo(address _erc20Asset, address _spender, uint256 _amountToApprove) internal returns(bool _success) {
        // Set owner
        address _owner = address(this); 

        // Approve liquidity to market contract
        _success = IERC20Decimals(_erc20Asset).approve(_spender, _amountToApprove);
        
        // Check liquidity approval
        uint256 _approvedBalance = IERC20Decimals(_erc20Asset).allowance(_owner, _spender);
        if(!_success || _approvedBalance != _amountToApprove){
            revert ApprovedLiquidityFailed(_erc20Asset, _owner, _spender, _amountToApprove);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Errors definitions
    // ---------------------------------------------------------------------------------------------
    error NoApprovedLiquidity(address _quoteAsset, address _owner, address _spender);
    error TransferLiquidityFailed(address _quoteAsset, address _from, address _to, uint256 _amount);
    error ApprovedLiquidityFailed(address _quoteAsset, address _owner, address _spender, uint256 _amount);
}