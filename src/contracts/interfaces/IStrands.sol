//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IStrands {

    // ---------------------------------------------------------------------------------------------
    // Main Functions
    // ---------------------------------------------------------------------------------------------

    function buyHedgedCall(uint256 _strikeId, uint256 _amount) external;
    function reHedge(uint256 _positionId) external;

    // ---------------------------------------------------------------------------------------------
    // Errors definitions
    // ---------------------------------------------------------------------------------------------
    error InvalidStrikeId(uint256 _strikeId);
    error InvalidAmount(uint256 _amount);
    error InvalidPosition(uint256 _positionId, address _user); 
    error OpenPositionLyraFailed(uint256 _strikeId, uint256 _amount);
    error OpenPositionSynthetixFailed(uint256 _positionid, int256 _deltaSize);   
}