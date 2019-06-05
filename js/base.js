const fs = require('fs')
const puppeteer = require('puppeteer')
const logging = require('./utils/logging')
const mailer = require('./utils/mailer')
const selectors = require('./selectors')

const env = process.env.NODE_ENV
const config = JSON.parse(fs.readFileSync('./configs/twitter-config.json', 'utf8'))

module.exports = class Base {
    async login(verify = false) {
        this.browser = await puppeteer.launch({
            headless: process.env.NODE_ENV === 'production',
            slowMo: 20
        })
        this.page = await this.browser.newPage()
        await this.page.setViewport({ width: 1366, height: 10000 })

        // login
        await this.page.goto('https://twitter.com/login')
        
        await this.page.waitForSelector(selectors.loginName)
        await this.page.type(selectors.loginName, config.address)
        
        await this.page.waitForSelector(selectors.loginPassword)
        await this.page.type(selectors.loginPassword, config.password)
        
        await this.page.waitForSelector(selectors.loginButton)
        await this.page.click(selectors.loginButton)
        
        // verify if needed
        if (verify) {
            try {
                await this.page.waitForSelector('input#challenge_response', { timeout: 5000 })
                await this.page.type('input#challenge_response', config.phoneNumber)
                
                await this.page.waitForSelector('input#email_challenge_submit', { timeout: 5000 })
                await this.page.click('input#email_challenge_submit')
                logging.info('succeeded to verify')
            } catch (err) {
                logging.info('no need to verify')
            }
        }
    }
    
    async relogin() {
        await this.browser.close()
        await this.login()
    }
    
    async close(command, text) {
        if (process.env.NODE_ENV === 'production' && this.browser) {
            await this.browser.close()
            logging.info('the browser was closed')
        }
        
        mailer.send(
            `${command} finished (env: ${env})`,
            text
        )
    }
    
    static async execute() {
        // should override it
        throw new Error('should override execute function')
    }
    
    async getNumOfFollows() {
        return this.getStatus('following')
    }
    
    async getNumOfFollowers() {
        return this.getStatus('followers')
    }
    
    async getStatus(type) {
        for (let i = 1; i <= 3; i += 1) {
            try {
                await this.page.goto('https://twitter.com/furimako')
                
                await this.page.waitForSelector(selectors.status(type))
                const numOfFollows = await this.page.evaluate(
                    selector => document.querySelector(selector).innerText,
                    selectors.status(type)
                )
                return parseInt(numOfFollows.replace(',', ''), 10)
            } catch (err) {
                logging.error(`unexpected error has occurred in getStatus (type: ${type}, try ${i} time(s))\n${err}`)
            }
            await this.relogin()
        }
        return false
    }
}
