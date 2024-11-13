import { developmentChains, networkConfig } from "../../helper-hardhat-config"
import { getNamedAccounts, network, deployments, ethers } from "hardhat"
import { Raffle, VRFCoordinatorV2_5Mock } from "../../typechain-types"
import { assert, expect } from "chai"
import { Address } from "hardhat-deploy/types"


// 1. get vrf subId
// 2. use subId for deploy
// 3. register the contract with vrf and subId
// 4. register the contract with automation
// 5. run test
developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          let raffle: Raffle
          let raffleEntranceFee: bigint
          let deployer: Address
          beforeEach(async () => {
              // 不需要自己部署了 会部署到测试网
              // await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)

              raffleEntranceFee = await raffle.getEntranceFee()
              deployer = (await getNamedAccounts()).deployer
          })

          describe("fulfillRandomWords", () => {
              it("works with live Chainlink Automation and Chainlink VRF", async () => {
                  // enter the raffle
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const deployer = await (await ethers.getSigners())[0].getAddress()

                  await new Promise(async (resolve, reject) => {
                      raffle.once(raffle.filters.WinnerPicked, async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const raffleWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await ethers.provider.getBalance(deployer)
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.rejected
                              assert.equal(raffleWinner.toString(), deployer)
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(
                                  winnerEndingBalance,
                                  winnerStartingBalance + raffleEntranceFee
							  )
							  assert(endingTimeStamp > startingTimeStamp)
                              resolve("")
                          } catch (e) {
                              reject(e)
                          }
                      })

                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalance = await ethers.provider.getBalance(deployer)
                  })
              })
          })
      })
