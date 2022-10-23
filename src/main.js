import dotenv from 'dotenv'
import { Client } from 'discord.js'

dotenv.config()

const Surveys = {}
const { DISCORD_KEYWORD, DISCORD_CLIENT_TOKEN } = process.env

const MSG_COMPLETE = 'Survey complete, thank you'

const client = new Client()
client.login(DISCORD_CLIENT_TOKEN)
client.on('ready', () => console.log(`Discord Bot "${client.user.tag}" ready`))
client.on('message', (message) => {
    if (message.author.bot) {
        return
    }
    if (!Surveys[message.author.id]) {
        Surveys[message.author.id] = new Survey(message)
        return
    }
    if (Surveys[message.author.id].complete) {
        message.reply(MSG_COMPLETE)
        return
    }
    Surveys[message.author.id].NextStep(message)
})

class Reactions {
    static Approve = '✅'
    static Deny    = '❌'
}

class Survey {
    LastMessage = null
    ActiveStepIdx = 0
    UserDataStore = {}
    StepProperties = [
        {
            incoming: msg => this.UserDataStore[msg.author.id] = { discord: msg.author },
            outgoing: () => 'What is your Epic ID?',
        },
        {
            incoming: async msg => {
                this.UserDataStore[msg.author.id] = { epic: msg.content.trim() }
            },
            outgoing: async message => {
                const { epic } = this.UserDataStore[message.author.id]
                return {
                    content: [
                        'Does this look correct?',
                        `https://rocketleague.tracker.network/rocket-league/profile/epic/${epic}/overview`
                    ],
                    // files: ['https://i.ibb.co/SJLQRdS/image.png'],
                    reactions: {
                        [Reactions.Approve]: () => {
                            this.ActiveStepIdx++
                            this.NextStep(message)
                        },
                        [Reactions.Deny]: () => {
                            this.ActiveStepIdx--
                            this.NextStep(message)
                        },
                    }
                }
            },
        },
        {
            outgoing: (message) => ({
                content: 'Are you wanting replay analysis?',
                reactions: {
                    [Reactions.Approve]: () => {
                        this.ActiveStepIdx++
                        this.NextStep(message)
                    },
                    [Reactions.Deny]: () => {
                        this.ActiveStepIdx--
                        this.NextStep(message)
                    },
                }
            }),
            
        }
    ]
    constructor(keywordMessage) {
        if (keywordMessage.content.toLowerCase() !== DISCORD_KEYWORD.toLowerCase()) {
            keywordMessage.reply(`Unknown keyword "${keywordMessage.content}"`)
            return
        }
        this.LastMessage = keywordMessage
        this.UserDataStore.Discord = keywordMessage.author
        this.NextStep(keywordMessage)
    }

    async NextStep(message) {
        if (Surveys[message.author.id]?.complete) {
            return
        }
        const step = this.StepProperties[this.ActiveStepIdx]
        if (!step) {
            Surveys[message.author.id].complete = true
            return message.reply(MSG_COMPLETE)
        }
        if (step.incoming) {
            await step.incoming(message)
        }
        const output = await step.outgoing(message)
        if (typeof output === typeof 'str') {
            await message.reply(output)
            this.ActiveStepIdx++
            return
        }
        const { content, files, reactions } = output
        const contentStr = Array.isArray(content) ? content.join('\n') : content
        const reply = await message.reply({ content: contentStr, files })
        if (!reactions) {
            this.ActiveStepIdx++
            return
        }
        for(const emoji in reactions || {}) {
            await reply.react(emoji)
            const filter = (reaction, user) => reaction.emoji.name === emoji
            const collector = reply.createReactionCollector(filter)
            collector.on('collect', (reaction, user) => {
                reactions[emoji]()
            })
            collector.on('remove', (reaction, user) => {})
        }
    }
}
