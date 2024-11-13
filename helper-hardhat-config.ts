// 从下到上的结构嵌套关系

import { ethers } from "ethers"

// --------------------- networkConfig ---------------------
export interface networkConfigItem {
    ethUsdPriceFeed?: string
    blockConfirmations?: number
    vrfCoordinatorV2?: string
	entranceFee: bigint
	gasLane: string
	subscriptionId: string
	callbackGasLimit: string
	interval: string
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem
}

export const networkConfig: networkConfigInfo = {
    localhost: {
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
        subscriptionId: "0",
        callbackGasLimit: "500000",
        interval: "30",
        blockConfirmations: 1,
    },
    hardhat: {
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
        subscriptionId: "0",
        callbackGasLimit: "500000",
        interval: "30",
        blockConfirmations: 1,
    },
    // Price Feed Address, values can be obtained at https://docs.chain.link/data-feeds/price-feeds/addresses
    // Default one is ETH/USD contract on Sepolia
    arbitrumSepolia: {
        ethUsdPriceFeed: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
        blockConfirmations: 1,
        vrfCoordinatorV2: "0x5ce8d5a2bc84beb22a398cca51996f7930313d61",
        entranceFee: ethers.parseEther("0.0001"),
        gasLane: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
        subscriptionId:
            "85737409964455882973977949974983310874029685366348483319434282058601949670808",
        callbackGasLimit: "500000",
        interval: "30",
    },
}
// --------------------- networkConfig ---------------------

// --------------------- developmentChains ---------------------
export const developmentChains = ["hardhat", "localhost"]
// --------------------- developmentChains ---------------------
