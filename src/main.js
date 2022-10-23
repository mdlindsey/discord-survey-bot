import dotenv from 'dotenv'
import { Client } from 'discord.js'

dotenv.config()

const Surveys = {}
const { DISCORD_KEYWORD, DISCORD_CLIENT_TOKEN } = process.env

const client = new Client()
client.login(DISCORD_CLIENT_TOKEN)
client.on('ready', () => {
    console.log('✅ Survey Bot is ready')
})
client.on('message', (message) => {
    if (message.author.bot) {
        return
    }
    if (Surveys[message.author.id]) {
        Surveys[message.author.id].NextStep(message)
    } else {
        Surveys[message.author.id] = new Survey(message)
    }
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
            outgoing: async msg => {
                const { epic } = this.UserDataStore[msg.author.id]
                return {
                    content: [
                        'Does this look correct?',
                        `https://rocketleague.tracker.network/rocket-league/profile/epic/${epic}/overview`
                    ],
                    // files: ['https://i.ibb.co/SJLQRdS/image.png'],
                    reactions: {
                        [Reactions.Approve]: () => {
                            this.ActiveStepIdx++
                        },
                        [Reactions.Deny]: () => {
                            this.ActiveStepIdx--
                        },
                    }
                }
            },
        },
        {
            outgoing: () => ({
                content: 'Are you wanting replay analysis?',
                reactions: {
                    [Reactions.Approve]: () => {
                        this.ActiveStepIdx++
                    },
                    [Reactions.Deny]: () => {
                        this.ActiveStepIdx--
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
        const step = this.StepProperties[this.ActiveStepIdx]
        if (!step) {
            return message.reply('Survey complete, thank you')
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
                this.NextStep(message)
            })
            collector.on('remove', (reaction, user) => {})
        }
    }
}
