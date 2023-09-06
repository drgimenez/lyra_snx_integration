const { ethers } = require("hardhat");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai;

const fs = require('fs');
const path = require('path');

let signer, tx;
let erc20_ABIPath;
let USDc_contract, sUSD_contract;
let optionMarket_ETH_contract, baseAsset_wETH_contract;

describe("Lyra protocolo exploration in local Optimism forked network", () => {
    before(async () => {

        console.log();
        console.log("---------------------------------------------------------------------------------------------");
        console.log("- Lyra protocolo exploration in local Optimism forked network");
        console.log("---------------------------------------------------------------------------------------------");
        console.log();

        // -------------------------------------------------------------------------------------------------------
        // Impersonate account with funds in Optimism
        // -------------------------------------------------------------------------------------------------------

        // USDC and SUSD signers account address
        const signer_address = "0xebe80f029b1c02862b9e8a70a7e5317c06f62cae";
        const signer_sUSD_address = "0xb729973d8c89c3225daf9bc2b2f2e6805f1e641b";

        // Impersonate accounts with USDC and SUSD balance
        signer = await ethers.getImpersonatedSigner(signer_address);
        signer_sUSD = await ethers.getImpersonatedSigner(signer_sUSD_address);

        // -------------------------------------------------------------------------------------------------------
        // Impersonate contracts in Optimism
        // -------------------------------------------------------------------------------------------------------

        // USDC and SUSD contract address on Optimism
        const USDC_contract_address = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607";
        const SUSD_contract_address = "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9";

        // Impersonate USDC and SUSD contract
        erc20_ABIPath = path.resolve(process.cwd(), "artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json");
        let erc20_Artifact = JSON.parse(fs.readFileSync(erc20_ABIPath, 'utf8'));
        USDc_contract = await ethers.getContractAt(erc20_Artifact.abi, USDC_contract_address, signer);
        sUSD_contract = await ethers.getContractAt(erc20_Artifact.abi, SUSD_contract_address, signer_sUSD);

        // -------------------------------------------------------------------------------------------------------
        // Impersonate contracts from Lyra protocol in Optimism
        // -------------------------------------------------------------------------------------------------------

        // ETH Option Market contract 
        // https://optimistic.etherscan.io/address/0x59c671B1a1F261FB2192974B43ce1608aeFd328E#code
        const optionMarket_ETH_address = "0x59c671B1a1F261FB2192974B43ce1608aeFd328E";

        // Impersonate ETH Option Market contract
        const optionMarket_ETH_ABIPath = path.resolve(process.cwd(), "artifacts/src/lyra_protocol/OptionMarket.sol/OptionMarket.json");
        const optionMarket_ETH_Artifact = JSON.parse(fs.readFileSync(optionMarket_ETH_ABIPath, 'utf8'));
        optionMarket_ETH_contract = await ethers.getContractAt(optionMarket_ETH_Artifact.abi, optionMarket_ETH_address, signer);
    });

    describe("Lyra Protocol Exploration", async () => {
        it("", async () => {
            // --------------------------------------------------------------------------------------------
            // Base Asset information
            // --------------------------------------------------------------------------------------------
            
            console.log();
            console.log("- Base Asset infromation");
            console.log('------------------------------------------------------------------------');
            const baseAsset_contratAddress = await optionMarket_ETH_contract.baseAsset(); // Wrapper ETH

            // Impersonate BaseAsset contract from Lyra protocol in Optimism
            const baseAsset_Artifact = JSON.parse(fs.readFileSync(erc20_ABIPath, 'utf8'));
            baseAsset_wETH_contract = await ethers.getContractAt(baseAsset_Artifact.abi, baseAsset_contratAddress, signer);
            expect(baseAsset_wETH_contract.address).to.be.equals(baseAsset_contratAddress);

            // Get signer balance in Base Asset wETH
            const baseAsset_signerBalance = await baseAsset_wETH_contract.balanceOf(signer.address);

            // Display Base Asset information
            console.log('-- Address:\t\t', baseAsset_contratAddress);
            console.log('-- Name:\t\t', await baseAsset_wETH_contract.name());
            console.log('-- Symbol:\t\t', await baseAsset_wETH_contract.symbol());
            console.log('-- Signer balance:\t', ethers.utils.formatUnits(baseAsset_signerBalance, 18));

            // --------------------------------------------------------------------------------------------
            // Quote Asset information
            // --------------------------------------------------------------------------------------------

            console.log();
            console.log("- Quote Asset infromation");
            console.log('------------------------------------------------------------------------');

            // Display Base Asset information
            console.log('-- Address:\t\t', USDc_contract.address);
            console.log('-- Name:\t\t', await USDc_contract.name());
            console.log('-- Symbol:\t\t', await USDc_contract.symbol());
            console.log('-- Signer balance:\t', ethers.utils.formatUnits(await USDc_contract.balanceOf(signer.address), 6));
            console.log();

            // --------------------------------------------------------------------------------------------
            // Live Boards information
            // --------------------------------------------------------------------------------------------
            const liveBoardsNumber = parseInt(await optionMarket_ETH_contract.getNumLiveBoards());
            const liveBoardsList = (await optionMarket_ETH_contract.getLiveBoards()).map(item => item);

            console.log();
            console.log("- Live boards infromation");
            console.log('------------------------------------------------------------------------');
            
            // Display boards information
            console.log('- Quantity:\t', liveBoardsNumber);
            console.log('- Id list:\t', liveBoardsList.join(', '));
            
            let boardInfo, strikesList;
            liveBoardsList.forEach(async function(boardId) {
                boardInfo = await optionMarket_ETH_contract.getOptionBoard(boardId);

                // Cast unix date to date GMT
                let expiryDate = new Date(parseInt(boardInfo.expiry.mul(1000)));
                expiryDate = new Date(expiryDate.getTime() + expiryDate.getTimezoneOffset() * 60 * 1000);
                expiryDate = expiryDate.toISOString().split('T');
                
                // Get list of strikes
                strikesList = (boardInfo.strikeIds).map(item => item);

                console.log();
                console.log("- Board Id:\t\t", parseInt(boardId));
                console.log("- Expiry date:\t\t", parseInt(boardInfo.expiry), "(", expiryDate[0], expiryDate[1], ")");
                console.log("- IV-Implied Volatility:", parseInt(boardInfo.iv), "(", ethers.utils.formatUnits(boardInfo.iv, 18), ")");
                console.log("- Is Frozen?:\t\t", boardInfo.frozen);
                console.log("- Strikes number:\t", strikesList.length);
            });
            console.log();
            
            console.log("- Borad id selected to work: 20");
            const board20Strikes = (await optionMarket_ETH_contract.getBoardStrikes(20)).map(item => item);
            // All boards have the same expiration date and similar iv.

            // Get strikes information
            console.log();
            console.log("- Strikes infromation of Board id 20");
            console.log('------------------------------------------------------------------------');

            // Display strikes information
            console.log("- Strikes number:\t", board20Strikes.length);
            console.log('- Id list:\t\t', board20Strikes.join(', '));
            
            let strikeInfo;
            board20Strikes.forEach(async function(strikeId) {
                strikeInfo = await optionMarket_ETH_contract.getStrike(strikeId);
                
                console.log();
                console.log("- Id:\t\t\t\t", parseInt(strikeId));
                console.log("- Price:\t\t\t", parseInt(strikeInfo.strikePrice), "(", ethers.utils.formatUnits(strikeInfo.strikePrice, 18), ")");
                console.log("- Skew:\t\t\t\t", parseInt(strikeInfo.skew), "(", ethers.utils.formatUnits(strikeInfo.skew, 18), ") Coefficient that affects volatility");
                console.log("- LongCall quantity:\t\t", parseInt(strikeInfo.longCall), "(", ethers.utils.formatUnits(strikeInfo.longCall, 18), ")");
                console.log("- ShortCallBase quantity:\t", parseInt(strikeInfo.shortCallBase), "(", ethers.utils.formatUnits(strikeInfo.shortCallBase, 18), ")");
                console.log("- ShortCallQuote quantity:\t", parseInt(strikeInfo.shortCallQuote), "(", ethers.utils.formatUnits(strikeInfo.shortCallQuote, 18), ")");
                console.log("- LongPut quantity:\t\t", parseInt(strikeInfo.longPut), "(", ethers.utils.formatUnits(strikeInfo.longPut, 18), ")");
                console.log("- ShortPut quantity:\t\t", parseInt(strikeInfo.shortPut), "(", ethers.utils.formatUnits(strikeInfo.shortPut, 18), ")");
            });
            console.log();
            console.log("- Strike id selected to work: 308"); // Selected because it has a previous LongCall
            console.log("------------------------------------------------------------------------");
            console.log("");
        });
    });
});