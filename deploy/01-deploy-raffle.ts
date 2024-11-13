import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { networkConfig, developmentChains } from "../helper-hardhat-config"
import { VRFCoordinatorV2_5Mock } from "../typechain-types"
import { EventLog } from "ethers"
import { ethers } from "hardhat"
import verify from "../utils/verify"

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("0.001")

const deployRaffle: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { getNamedAccounts, deployments, network, ethers } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    let vrfCoordinatorV25Address, subscriptionId, vrfCoordinatorV2Mock: VRFCoordinatorV2_5Mock
    if (developmentChains.includes(network.name)) {
        // 本地环境
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2_5Mock")
        vrfCoordinatorV25Address = await vrfCoordinatorV2Mock.getAddress()

        // vrf创建订阅
        const subscriptionIdResponse = await vrfCoordinatorV2Mock.createSubscription()
        const subscriptionIdReceipt = await subscriptionIdResponse.wait()
        subscriptionId = subscriptionIdReceipt!.logs[0].topics[1]
        // fund subscription, usually you need link token on a real network
        // vrf充值操作
        vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        // 测试环境
        vrfCoordinatorV25Address = networkConfig[network.name].vrfCoordinatorV2
        subscriptionId = networkConfig[network.name].subscriptionId
    }
    const entranceFee = networkConfig[network.name].entranceFee
    const gasLane = networkConfig[network.name].gasLane
    const callbackGasLimit = networkConfig[network.name].callbackGasLimit
    const interval = networkConfig[network.name].interval

    const args = [
        vrfCoordinatorV25Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations || 1,
    })
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args) // args 与contract相同
    } else {
        // 消费者添加到订阅中
        await vrfCoordinatorV2Mock!.addConsumer(subscriptionId, raffle.address)
        // 充值
        await vrfCoordinatorV2Mock!.fundSubscription(subscriptionId, ethers.parseEther("1"))
    }
    log("---------------------------------------------------------")
}

export default deployRaffle
deployRaffle.tags = ["all", "raffle"]
