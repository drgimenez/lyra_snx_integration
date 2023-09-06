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
let optionToken_ETH_contract, oracleGWAV_contract;  // Lyra protocol contracts
let ProxyPerpsV2MarketConsolidated_contract;        // Synthetix protocol contract
let strands_contract;

// Constans and variables inputs for test
const strikeId = 308;
const secondsAgo = 0;
const amount = 3;

describe("Strands Contract tests in local Optimism forked network started", () => {
    before(async () => {

        console.log();
        console.log("---------------------------------------------------------------------------------------------");
        console.log("- Strands Contract tests in local Optimism forked network started");
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

        // Impersonate ETH Option Token contract (NFT)
        const optionToken_ETH_address = "0xA48C5363698Cef655D374675fAf810137a1b2EC0";
        const optionToken_ETH_ABIPath = path.resolve(process.cwd(), "artifacts/src/lyra_protocol/OptionToken.sol/OptionToken.json");
        const optionToken_ETH_Artifact = JSON.parse(fs.readFileSync(optionToken_ETH_ABIPath, 'utf8'));
        optionToken_ETH_contract = await ethers.getContractAt(optionToken_ETH_Artifact.abi, optionToken_ETH_address, signer);

        // Impersonate GWAV Oracle contract
        const oracleGWAV_address = "0x75dB0A2b3e08f22a42d0C08A96fb0CeDCD3bea1B";
        const oracleGWAV_ABIPath = path.resolve(process.cwd(), "artifacts/src/lyra_protocol/periphery/GWAVOracle.sol/GWAVOracle.json");
        const oracleGWAV_Artifact = JSON.parse(fs.readFileSync(oracleGWAV_ABIPath, 'utf8'));
        oracleGWAV_contract = await ethers.getContractAt(oracleGWAV_Artifact.abi, oracleGWAV_address, signer);

        // -------------------------------------------------------------------------------------------------------
        // Impersonate contracts from Sinthetix protocol in Optimism
        // -------------------------------------------------------------------------------------------------------

        // Impersonate ProxyPerpsV2 contract with IPerpsV2MarketConsolidated interface
        const ProxyPerpsV2MarketConsolidated_address = "0x2B3bb4c683BFc5239B029131EEf3B1d214478d93";
        const ProxyPerpsV2MarketConsolidated_ABIPath = path.resolve(process.cwd(), "artifacts/node_modules/synthetix/contracts/interfaces/IPerpsV2MarketConsolidated.sol/IPerpsV2MarketConsolidated.json");
        const ProxyPerpsV2MarketConsolidated_Artifact = JSON.parse(fs.readFileSync(ProxyPerpsV2MarketConsolidated_ABIPath, 'utf8'));
        ProxyPerpsV2MarketConsolidated_contract = await ethers.getContractAt(ProxyPerpsV2MarketConsolidated_Artifact.abi, ProxyPerpsV2MarketConsolidated_address, signer);

        // -------------------------------------------------------------------------------------------------------
        // Deploy Strands contract
        // -------------------------------------------------------------------------------------------------------

        // ETH Option Market contract 
        // https://optimistic.etherscan.io/address/0x59c671B1a1F261FB2192974B43ce1608aeFd328E#code
        const optionMarket_ETH_address = "0x59c671B1a1F261FB2192974B43ce1608aeFd328E";

        // LyraCon contract deploy
        const lyraCon_contract_path = "src/contracts/Strands.sol:Strands";
        const lyraCon_factory = await ethers.getContractFactory(lyraCon_contract_path, signer);
        strands_contract = await lyraCon_factory.deploy(
            optionMarket_ETH_address,               // Lyra ETH Option Market address
            optionToken_ETH_address,                // Lyra ETH Option Token address
            oracleGWAV_address,                     // Lyra GWAV Oracle address
            ProxyPerpsV2MarketConsolidated_address, // Sinthetix proxy address to ETH Futures Market
            SUSD_contract_address                   // SUSD contract address
        );
        //console.log("strands_contract address", strands_contract.address);

        // -------------------------------------------------------------------------------------------------------
        // Transfer sUSD from signer_sUSD to signer
        // -------------------------------------------------------------------------------------------------------

        const amountToTrasnfer = await sUSD_contract.balanceOf(signer_sUSD.address);
        tx = await sUSD_contract.transfer(signer.address, amountToTrasnfer);
        await tx.wait(1);
        console.log();
    });

    // -------------------------------------------------------------------------------------------------------
    // - Method buyHedgedCall negative test
    // -------------------------------------------------------------------------------------------------------

    describe("Method buyHedgedCall negative test", () => {
        it("Try zero strikeId test", async () => {
            const _strikeId = 0;
            const _amount = 1;
            await expect(strands_contract.buyHedgedCall(_strikeId, _amount)).to.be.revertedWith("InvalidStrikeId");
        });

        it("Try invalid strikeId test", async () => {
            const _strikeId = 9999;
            const _amount = 1;
            await expect(strands_contract.buyHedgedCall(_strikeId, _amount)).to.be.revertedWith("InvalidStrikeId");
        });

        it("Try invalid amount test", async () => {
            const _strikeId = 1;
            const _amount = 0;
            await expect(strands_contract.buyHedgedCall(_strikeId, _amount)).to.be.revertedWith("InvalidAmount");
        });

        it("Try with no approved liquidity test", async () => {
            const _strikeId = 308;
            const _amount = 1;
            await expect(strands_contract.buyHedgedCall(_strikeId, _amount)).to.be.revertedWith("NoApprovedLiquidity");
        });
    });

    // -------------------------------------------------------------------------------------------------------
    // - Method buyHedgedCall positive test
    // -------------------------------------------------------------------------------------------------------

    describe("Method buyHedgedCall positive test", () => {
        it("Approved USDc liquidity from sender to Strands contract", async () => {
            // Get Strike Price from GWAV Oracle in Lyra protocol
            const strikePrice = await oracleGWAV_contract.optionPriceGWAV(strikeId, secondsAgo);
            
            // Rounded UP to the nearest integer
            const strike_CallPrice = Math.ceil(ethers.utils.formatUnits(strikePrice.callPrice, 18));
            const strike_CallPrice_6zeros = ethers.utils.parseUnits(strike_CallPrice.toString(), 6);

            // Estimated fee 2%
            const estimatedFeePercentage = 2;
            const estimatedFeeAmount = Math.ceil(ethers.utils.formatUnits(strike_CallPrice_6zeros.mul(estimatedFeePercentage).div(100), 6));

            // Calculate total amount to approve
            const estimatedStrikePrice = strike_CallPrice + estimatedFeeAmount;
            const amoutToApprove = ethers.utils.parseUnits(estimatedStrikePrice.toString(), 6);

            // Approve USDc amount for operations in Lyra protocol
            tx = await USDc_contract.approve(strands_contract.address, amoutToApprove);
            await tx.wait(1);
    
            // Check approved balance
            const approvedBalance = await USDc_contract.allowance(signer.address, strands_contract.address);
            expect(approvedBalance).to.be.equals(amoutToApprove);
        });
           
        it("Approved sUSD liquidity from sender to Strands contract", async () => {
            // Get Lyra delta of the amount of options to by and use it as operation size
            const _deltaSize = await oracleGWAV_contract.deltaGWAV(strikeId, secondsAgo);
                            
            // Get price of the ETH perpetual future
            const contractPrice = await ProxyPerpsV2MarketConsolidated_contract.fillPrice(_deltaSize);

            // Get operation fees
            const orderType = 2; // 0:Atomic, 1:Delayed, 2:Offchain
            const operationFee = await ProxyPerpsV2MarketConsolidated_contract.orderFee(_deltaSize, orderType);
            
            // Estimated 2% for keeper fee
            const estimatedKeeperFee = 2;
            const estimatedKeeperFeeAmount = contractPrice.price.mul(estimatedKeeperFee).div(100);

            // Estimate margin for the operation
            const marginDelta = contractPrice.price.add(operationFee.fee).add(estimatedKeeperFeeAmount).mul(2);
            
            // Approve sUSD amount for operations in Sinthetic protocol
            sUSD_contract = sUSD_contract.connect(signer);
            tx = await sUSD_contract.approve(strands_contract.address, marginDelta);
            await tx.wait(1);

            // Check approved balance
            approvedBalance = await sUSD_contract.allowance(signer.address, strands_contract.address);
            expect(approvedBalance).to.be.equals(marginDelta);
        });

        it("Call with valid strikeId and amount test", async () => {
            // Get open position information for Strands contract before operation
            const _positionBefore = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);
            expect(_positionBefore.length).to.be.equals(0);

            // Get option token balance before operation
            const balanceOfBefore = await optionToken_ETH_contract.balanceOf(strands_contract.address);
            expect(balanceOfBefore).to.be.equals(0);

            // Get margin before operation
            const _marginBefore = await ProxyPerpsV2MarketConsolidated_contract.remainingMargin(strands_contract.address)
            expect(_marginBefore.marginRemaining).to.be.equals(0);

            // Call buyHedgedCall method
            tx = await strands_contract.buyHedgedCall(strikeId, amount);
            await tx.wait(1);

            // Check position information for Strands contract after operation
            const _positionAfter = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);
            expect(_positionAfter.length).to.be.equals(1);
        });

        // Lyra status test
        describe("Lyra position information result test", async () => {
            let _position;

            before(async () => {
                // Get position information in Lyra protocole after operation
                _position = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);
                expect(_position[0].positionId).to.be.gt(0);
            });
            
            it("Lyra: getPositionWithOwner method test", async () => {        
                // Get open position information for Strands contract before operation
                const _positionWithOwner = await optionToken_ETH_contract.getPositionWithOwner(_position[0].positionId);
                
                // Check position information for Strands contract after operation
                expect(_positionWithOwner.strikeId).to.be.equals(strikeId);
                expect(_positionWithOwner.optionType).to.be.equals(0);    // 0:LONG_CALL
                expect(_positionWithOwner.amount).to.be.equals(amount);
                expect(_positionWithOwner.collateral).to.be.equals(0);
                expect(_positionWithOwner.state).to.be.equals(1);         // 1:ACTIVE
                expect(_positionWithOwner.owner).to.be.equals(strands_contract.address);
            });
    
            it("Lyra: Option NFT owner check test", async () => {
                // Get option token balance after operation
                const balanceOf = await optionToken_ETH_contract.balanceOf(strands_contract.address);
                expect(balanceOf).to.be.equals(1);
            });
        });

        // Synthetix status test
        describe("Synthetix position information result test", async () => {
            it("Synthetix: Position information test", async () => {
                // Get position information from Synthetix protocole after operation
                const _synthetixDelayedOrder = await ProxyPerpsV2MarketConsolidated_contract.delayedOrders(strands_contract.address);
                expect(_synthetixDelayedOrder.length).to.be.gt(0);

                // Get Synthetix position information
                const _totalSupplay = await strands_contract.totalPosition();
                const _positionId = await strands_contract.positionIndex(_totalSupplay);               
                const _positionSynthetix = await strands_contract.positionSynthetix(_positionId);
                expect(_positionSynthetix.length).to.be.gt(0);

                // Get blocktime stamp
                const _blocktime = await ethers.provider.getBlock();

                expect(_synthetixDelayedOrder.isOffchain).to.be.true;
                expect(_synthetixDelayedOrder.sizeDelta).to.be.equals(_positionSynthetix.delta);
                expect(_synthetixDelayedOrder.desiredFillPrice).to.be.equals(_positionSynthetix.price);
                expect(_synthetixDelayedOrder.targetRoundId).to.be.equals(0);
                expect(_synthetixDelayedOrder.commitDeposit).to.be.equals(0);
                expect(_synthetixDelayedOrder.keeperDeposit).to.be.gt(0);
                expect(_synthetixDelayedOrder.executableAtTime).to.be.equals(0);
                expect(_synthetixDelayedOrder.intentionTime).to.be.equals(_blocktime.timestamp);
            });
    
            it("Synthetix: Margin test", async () => {
                const _remainingMargin = await ProxyPerpsV2MarketConsolidated_contract.remainingMargin(strands_contract.address)
                const _expectedMargin = await strands_contract.marginOf(signer.address);
                expect(_remainingMargin.marginRemaining).to.be.equals(_expectedMargin);
            });
        });
    });

    // -------------------------------------------------------------------------------------------------------
    // - Method reHedge negative test
    // -------------------------------------------------------------------------------------------------------

    describe("Method reHedge negative test", () => {
        it("Try zero positionId test", async () => {
            const _positionId = 0;
            await expect(strands_contract.reHedge(_positionId)).to.be.revertedWith("InvalidPosition");
        });

        it("Try invalid positionId test", async () => {
            const _positionId = 9999;
            await expect(strands_contract.reHedge(_positionId)).to.be.revertedWith("InvalidPosition");
        });
    });

    // -------------------------------------------------------------------------------------------------------
    // - Method reHedge positive test
    // -------------------------------------------------------------------------------------------------------

    describe("Method reHedge positive test", () => {
        let _positionBefore, balanceOfBefore, _marginBefore;

        before(async () => {
            // Get open position information for Strands contract before operation
            _positionBefore = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);
            expect(_positionBefore.length).to.be.equals(1);

            // Get option token balance before operation
            balanceOfBefore = await optionToken_ETH_contract.balanceOf(strands_contract.address);
            expect(balanceOfBefore).to.be.equals(1);

            // Get margin before operation
            _marginBefore = await ProxyPerpsV2MarketConsolidated_contract.remainingMargin(strands_contract.address)
            const _expectedMargin = await strands_contract.marginOf(signer.address);
            expect(_marginBefore.marginRemaining).to.be.equals(_expectedMargin);
        });

        it("Time step simulation", async () => {
            // Get blocktime stamp before
            const _blockTimeBefore = await ethers.provider.getBlock();

            // simulate pass of 1 days
            const secondsToAdd = 84600; 
            await ethers.provider.send("evm_increaseTime", [secondsToAdd]);
            
            // Mine a new block for the time change to take effect
            await ethers.provider.send("evm_mine");

            // Get blocktime stamp after
            const _blockTimeAfter = await ethers.provider.getBlock();
            expect(_blockTimeAfter.timestamp).to.be.gte(_blockTimeBefore.timestamp + secondsToAdd);
        });

        it("Approve margin for the reHedge operation", async () => {
            // Get open position information
            const _position = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);

            // Constants and variables
            const _strikeID = _position[0].strikeId;
            const _secondsAgo = 0; // 0 For current volatility

            // Get delta size
            const _deltaSize = await oracleGWAV_contract.deltaGWAV(_strikeID, _secondsAgo);

            // Get price of the ETH perpetual future
            const _contractPrice = await ProxyPerpsV2MarketConsolidated_contract.fillPrice(_deltaSize);

            // Get operation fees
            const _orderType = 2; // 0:Atomic, 1:Delayed, 2:Offchain
            const _operationFee = await ProxyPerpsV2MarketConsolidated_contract.orderFee(_deltaSize, _orderType);
            
            // Estimated 2% for keeper fee
            const _estimatedKeeperFee = 2;
            const _estimatedKeeperFeeAmount = _contractPrice.price.mul(_estimatedKeeperFee).div(100);

            // Estimate margin for the operation
            const _requiredMargin = _contractPrice.price.add(_operationFee.fee).add(_estimatedKeeperFeeAmount).mul(2);

            // If it is required more margin than the remaining margin 
            if (_marginBefore.marginRemaining < _requiredMargin) {
                // Amount to approve
                const _amountToApprove = _requiredMargin.sub(_marginBefore.marginRemaining);
                                
                // Approve sUSD amount for operations in Sinthetic protocol
                sUSD_contract = sUSD_contract.connect(signer);
                tx = await sUSD_contract.approve(strands_contract.address, _amountToApprove);
                await tx.wait(1);
                
                // Check approved balance
                const _approvedBalance = await sUSD_contract.allowance(signer.address, strands_contract.address);
                expect(_approvedBalance).to.be.equals(_amountToApprove);
            }
        });

        it("Execute reHedge operation", async () => {
            // Call reHedge method
            tx = await strands_contract.reHedge(_positionBefore[0].positionId);
            await tx.wait(1);

            // Get open position information for Strands contract before operation
            const _positionAfter = await optionToken_ETH_contract.getOwnerPositions(strands_contract.address);
            expect(_positionAfter.length).to.be.equals(1);

            // Get option token balance before operation
            const balanceOfAfter = await optionToken_ETH_contract.balanceOf(strands_contract.address);
            expect(balanceOfAfter).to.be.equals(1);

            // Get margin before operation
            const _marginAfter = await ProxyPerpsV2MarketConsolidated_contract.remainingMargin(strands_contract.address)
            const _expectedMargin = await strands_contract.marginOf(signer.address);
            expect(_marginAfter.marginRemaining).to.be.equals(_expectedMargin);

            // Get position information from synthetix protocole after operation
            const _synthetixDelayedOrder = await ProxyPerpsV2MarketConsolidated_contract.delayedOrders(strands_contract.address);
            expect(_synthetixDelayedOrder.length).to.be.gt(1);

            // Get Synthetix position information             
            const _positionSynthetix = await strands_contract.positionSynthetix(_positionBefore[0].positionId);
            expect(_positionSynthetix.length).to.be.gt(0);

            // Get blocktime stamp
            const _blocktime = await ethers.provider.getBlock();

            expect(_synthetixDelayedOrder.isOffchain).to.be.true;
            expect(_synthetixDelayedOrder.sizeDelta).to.be.equals(_positionSynthetix.delta);
            expect(_synthetixDelayedOrder.desiredFillPrice).to.be.equals(_positionSynthetix.price);
            expect(_synthetixDelayedOrder.targetRoundId).to.be.equals(0);
            expect(_synthetixDelayedOrder.commitDeposit).to.be.equals(0);
            expect(_synthetixDelayedOrder.keeperDeposit).to.be.gt(0);
            expect(_synthetixDelayedOrder.executableAtTime).to.be.equals(0);
            expect(_synthetixDelayedOrder.intentionTime).to.be.equals(_blocktime.timestamp);
        });
    });
});
