import { developmentChains, networkConfig } from "../../helper-hardhat-config"
import { getNamedAccounts, network, deployments, ethers } from "hardhat"
import { Raffle, VRFCoordinatorV2_5Mock } from "../../typechain-types"
import { assert, expect } from "chai"
import { Address } from "hardhat-deploy/types"

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          let raffle: Raffle
          let vrfCoordinatorV2_5Mock: VRFCoordinatorV2_5Mock
          let raffleEntranceFee: bigint
          let deployer: Address
          let player: Address
          let interval: number
          beforeEach(async () => {
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2_5Mock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer)

              raffleEntranceFee = await raffle.getEntranceFee()
              deployer = (await getNamedAccounts()).deployer
              player = (await getNamedAccounts()).player
              // 想运算需要用ethers的工具
              interval = ethers.toNumber(await raffle.getInterval())
          })

          describe("constructor", () => {
              it("initializes the raffle correctly", async () => {
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[network.name].interval)
              })
          })
          describe("enter Raffle", () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnougthETHEntered",
                  )
              })
              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emit event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  )
              })
              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  // 控制出块
                  await network.provider.send("evm_increaseTime", [interval + 1])
                  await network.provider.send("evm_mine", [])
                  // await network.provider.request({method: "evm_mine", params: []}) 与上面相同 但是慢一点

                  // pretend to be a Automation
                  await raffle.performUpkeep("0x")
                  // 测试确实返回异常
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
              describe("checkUpkeep", () => {
                  it("return false if people haven't sent any ETH", async () => {
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                      const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                      assert(!upkeepNeeded)
                  })
                  it("return false if raffle isn't open", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                      await raffle.performUpkeep("0x")

                      const raffleState = await raffle.getRaffleState()
                      const { upkeepNeeded } = await raffle.checkUpkeep("0x")

                      assert.equal(raffleState.toString(), "1")
                      assert.equal(upkeepNeeded, false)
                  })
                  it("return false if enough time hasn't passed", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval - 10])
                      await network.provider.send("evm_mine", [])
                      const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                      assert(!upkeepNeeded)
                  })
                  it("return true if enough time has passed, has players, eth, and is open", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                      const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                      assert(upkeepNeeded)
                  })
              })
              describe("performUpkeep", () => {
                  it("it can only run if checkUpkeep is true", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                      const tx = await raffle.performUpkeep("0x")
                      assert(tx)
                  })

                  it("reverts when checkupkeep is false", async () => {
                      await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                          raffle,
                          "Raffle__UpkeepNotNeeded",
                      )
                  })

                  it("updates the raffle state, emits and event, and calls the vrf coordinator", async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                      const txResponse = await raffle.performUpkeep("0x")
                      const txReceipt = await txResponse.wait()

                      const requestId = txReceipt?.logs[1].topics[1]
                      assert(requestId && ethers.toNumber(requestId) > 0)

                      const raffleState = await raffle.getRaffleState()
                      assert(raffleState.toString() == "1")
                  })
              })
              describe("fulfillRandomWords", () => {
                  beforeEach(async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval + 1])
                      await network.provider.send("evm_mine", [])
                  })

                  it("can only be called after performUpkeep", async () => {
                      await expect(
                          vrfCoordinatorV2_5Mock.fulfillRandomWords(0, raffle.getAddress()),
                      ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest")
                      await expect(
                          vrfCoordinatorV2_5Mock.fulfillRandomWords(1, raffle.getAddress()),
                      ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest")
                  })

                  it("picks a winner, resets the lottery, and sends money", async () => {
                      // 用ehters中的虚拟账户参与抽奖
                      const additionalEntrants = 3
                      const startingAccountIndex = 1 // depolyer 0

                      const accounts = await ethers.getSigners()
                      for (
                          let i = startingAccountIndex;
                          i < startingAccountIndex + additionalEntrants;
                          i++
                      ) {
                          const accountConnectRaffle = raffle.connect(accounts[i])
                          await accountConnectRaffle.enterRaffle({ value: raffleEntranceFee })
                      }
                      const startingTimeStamp = await raffle.getLatestTimeStamp()

                      // performUpkeep （mock being automation）
                      // 调用mock 的 fulfillRandomWords (mock being VRF)
                      // fulfillRandomWords 等待回调

                      // 需要用到 listener监听 fulfillRandomWords中的event
                      // 因为不能等到listener监听完成前结束 所以需要创建一个Promise
                      await new Promise(async (resolve, reject) => {
                          // 先监听
                          raffle.once(raffle.filters.WinnerPicked, async () => {
                              console.log("Found the event!")
                              try {
                                  // all asserts
                                  const recentWinner = await raffle.getRecentWinner()
                                  const raffleState = await raffle.getRaffleState()
                                  const endingTimeStamp = await raffle.getLatestTimeStamp()
                                  const numPlayers = await raffle.getNumberOfPlayers()
                                  assert.equal(numPlayers, 0n)
                                  assert.equal(raffleState, 0n)
                                  assert(endingTimeStamp > startingTimeStamp)

                                  const winnerEndingBalance =
                                      await raffle.runner?.provider?.getBalance(recentWinner)

                                  assert.equal(
                                      winnerEndingBalance,
                                      winnerStartingBalance +
                                          raffleEntranceFee *
                                              (1n + ethers.toBigInt(additionalEntrants)),
                                  )
                              } catch (e) {
                                  // error exit
                                  reject(e)
                              }
                              // success exit
                              resolve("success")
                          })
                          // 再触发
                          // mock ChainLink Automation
                          const tx = await raffle.performUpkeep("0x")
                          const receipt = await tx.wait()
                          // mock ChainLink VRF
                          const requestId = receipt?.logs[1].topics[1]
                          assert(requestId)
                          const address = await raffle.getAddress()
                          const winnerStartingBalance = await raffle.runner!.provider!.getBalance(
                              accounts[1].address,
                          )
                          try {
                              await vrfCoordinatorV2_5Mock.fulfillRandomWords(
                                  ethers.toNumber(requestId),
                                  address,
                              )
                          } catch (e) {
                              reject(e)
                          }
                      })
                  })
              })
          })
      })
