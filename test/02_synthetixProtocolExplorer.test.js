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
let ProxyPerpsV2MarketConsolidated_contract, addressResolver_contract;  // Synthetix protocol contract

describe("Synthetix protocolo exploration in local Optimism forked network", () => {
    before(async () => {
        console.log("---------------------------------------------------------------------------------------------");
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
        // Impersonate contracts from Sinthetix protocol in Optimism
        // -------------------------------------------------------------------------------------------------------

        // Impersonate ProxyPerpsV2 contract with IPerpsV2MarketConsolidated interface
        const ProxyPerpsV2MarketState_address = "0x6aBC19F21D5Ce23abf392329Ef7B118c7b5F2AA8";
        const ProxyPerpsV2MarketState_ABIPath = path.resolve(process.cwd(), "artifacts/node_modules/synthetix/contracts/interfaces/IPerpsV2MarketState.sol/IPerpsV2MarketState.json");
        const ProxyPerpsV2MarketState_Artifact = JSON.parse(fs.readFileSync(ProxyPerpsV2MarketState_ABIPath, 'utf8'));
        ProxyPerpsV2MarketState_contract = await ethers.getContractAt(ProxyPerpsV2MarketState_Artifact.abi, ProxyPerpsV2MarketState_address, signer);

        // Impersonate ProxyPerpsV2 contract with IPerpsV2MarketConsolidated interface
        const ProxyPerpsV2MarketConsolidated_address = "0x2B3bb4c683BFc5239B029131EEf3B1d214478d93";
        const ProxyPerpsV2MarketConsolidated_ABIPath = path.resolve(process.cwd(), "artifacts/node_modules/synthetix/contracts/interfaces/IPerpsV2MarketConsolidated.sol/IPerpsV2MarketConsolidated.json");
        const ProxyPerpsV2MarketConsolidated_Artifact = JSON.parse(fs.readFileSync(ProxyPerpsV2MarketConsolidated_ABIPath, 'utf8'));
        ProxyPerpsV2MarketConsolidated_contract = await ethers.getContractAt(ProxyPerpsV2MarketConsolidated_Artifact.abi, ProxyPerpsV2MarketConsolidated_address, signer);

        // Impersonate ProxyPerpsV2 contract with IPerpsV2MarketConsolidated interface
        const addressResolverProxy_address = "0x1Cb059b7e74fD21665968C908806143E744D5F30";
        const addressResolver_ABIPath = path.resolve(process.cwd(), "artifacts/node_modules/synthetix/contracts/interfaces/IAddressResolver.sol/IAddressResolver.json");
        const addressResolver_Artifact = JSON.parse(fs.readFileSync(addressResolver_ABIPath, 'utf8'));
        addressResolver_contract = await ethers.getContractAt(addressResolver_Artifact.abi, addressResolverProxy_address, signer);
    });

    describe("Synthetix Protocol Exploration", async () => {
        it("", async () => {
            // --------------------------------------------------------------------------------------------
            // Market information
            // --------------------------------------------------------------------------------------------
            
            console.log();
            console.log("---------------------------------------------------------------------------------------------");
            console.log("- Market infromation");
            console.log("---------------------------------------------------------------------------------------------");
            
            // Get markert information
            const marketKey = await ProxyPerpsV2MarketConsolidated_contract.marketKey();
            const marketName = ethers.utils.parseBytes32String(marketKey);
            const marketSize = await ProxyPerpsV2MarketConsolidated_contract.marketSize();
            const marketSkew = await ProxyPerpsV2MarketConsolidated_contract.marketSkew();

            // Display Market information
            console.log('-- Key:\t', marketKey);
            console.log('-- Name:', marketName);
            console.log('-- Size:', ethers.utils.formatUnits(marketSize, 18));
            console.log('-- Skew:', ethers.utils.formatUnits(marketSkew, 18));

            // --------------------------------------------------------------------------------------------
            // Base Asset information
            // --------------------------------------------------------------------------------------------
            
            console.log();
            console.log("---------------------------------------------------------------------------------------------");
            console.log("- Base Asset infromation");
            console.log("---------------------------------------------------------------------------------------------");
            const baseAssetKey = await ProxyPerpsV2MarketConsolidated_contract.baseAsset();
            const baseAssetName = ethers.utils.parseBytes32String(baseAssetKey);
            const baseAssetAddress = await addressResolver_contract.getSynth(baseAssetKey);

            // Impersonate BaseAsset contract from Lyra protocol in Optimism
            const baseAsset_Artifact = JSON.parse(fs.readFileSync(erc20_ABIPath, 'utf8'));
            const baseAsset_contract = await ethers.getContractAt(baseAsset_Artifact.abi, baseAssetAddress, signer);

            // Get signer balance in Base Asset wETH
            const baseAsset_signerBalance = await baseAsset_contract.balanceOf(signer.address);

            // Display Base Asset information
            console.log('-- Key:\t\t\t', baseAssetKey);
            console.log('-- Name:\t\t', baseAssetName);
            console.log('-- Address:\t\t', baseAssetAddress);
            console.log('-- Name:\t\t', await baseAsset_contract.name());
            console.log('-- Symbol:\t\t', await baseAsset_contract.symbol());
            console.log('-- Signer balance:\t', ethers.utils.formatUnits(baseAsset_signerBalance, 18));
        });
    });
});
