import dotenv from 'dotenv'
import { Client } from 'discord.js'

dotenv.config()

const Surveys = {}
const { DISCORD_KEYWORD, DISCORD_CLIENT_TOKEN } = process.env

const client = new Client()
client.login(DISCORD_CLIENT_TOKEN)
client.on('ready', () => {
    console.log('Discord Coaching Bot is ready for action!')
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

class SurveyStep {
    constructor(client, message, next, prev) {
        this.client = client
        this.message = message
        this.next = next
        this.prev = prev
    }
    async Exec() {

    }
}

class Survey {
    LastMessage = null
    ActiveStepIdx = 0
    UserDataStore = {}
    StepProperties = [
        {
            incoming: msg => this.UserDataStore[msg.author.id] = { discord: msg.author },
            message: 'What is your Epic ID?',
        },
        {
            incoming: async msg => {
                this.UserDataStore[msg.author.id] = { epic: msg.content.trim() }
                const loadingMsg = await msg.reply('One moment...')
                await new Promise(r => setTimeout(r, 3500))
                loadingMsg.delete()
            },
            message: 'Does this look correct?',
            attachments: ['https://i.ibb.co/SJLQRdS/image.png'],
            reactions: {
                [Reactions.Approve]: () => {
                    this.ActiveStepIdx++
                },
                [Reactions.Deny]: () => {
                    this.ActiveStepIdx--
                },
            }
        },
        {
            message: 'Are you wanting replay analysis?',
            reactions: {
                [Reactions.Approve]: () => {
                    this.ActiveStepIdx++
                },
                [Reactions.Deny]: () => {
                    this.ActiveStepIdx--
                },
            }
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
        const payload = !step.attachments ? step.message : {
            content: step.message,
            files: step.attachments,
        }
        const reply = await message.reply(payload)
        if (!step.reactions) {
            this.ActiveStepIdx++
            return
        }
        for(const emoji in step.reactions || {}) {
            await reply.react(emoji)
            const filter = (reaction, user) => reaction.emoji.name === emoji
            const collector = reply.createReactionCollector(filter)
            collector.on('collect', (reaction, user) => {
                // in case you want to do something when someone reacts with ❤
                console.log('reaction added')
                step.reactions[emoji]()
                this.NextStep(message) // but what if we want to allow multiple reactions?
            })
            collector.on('remove', (reaction, user) => {
                // in case you want to do something when someone removes their reaction
                console.log('reaction removed')
            })
        }
    }
}
