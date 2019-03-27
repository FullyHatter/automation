const Base = require('./base')
const logging = require('./utils/logging')

module.exports = class Follow extends Base {
    constructor(count, keyword) {
        super()
        this.count = count
        this.keyword = keyword
    }
    
    async execute() {
        const numOfFollowsBefore = await this.getNumOfFollows()
        logging.info(`numOfFollowsBefore: ${numOfFollowsBefore}`)
        
        const targetURLs = await this.getTargetURLsWithKeyword(this.keyword)
        logging.info(`targetURLs are shown below\n${targetURLs.join('\n')}`)
        
        let result = await this.clickFollowButtons(targetURLs)
        const totalCount = Object.values(result)
            .map(v => v.success)
            .reduce((total, v) => total + v)
        const resultStr = Object.keys(result)
            .map(key => `URL: ${key}, follow: ${result[key].success}, fail: ${result[key].fail}`)
            .join('\n')
        
        const numOfFollowsAfter = await this.getNumOfFollows()
        logging.info(`numOfFollowsAfter: ${numOfFollowsAfter}`)
        
        result = `keyword: ${this.keyword}`
            + `\ncount (target): ${this.count}`
            + `\ncount (result): ${totalCount}`
            + `\nfollow count (before): ${numOfFollowsBefore}`
            + `\nfollow count (after): ${numOfFollowsAfter}`
            + '\n'
            + `\n${resultStr}`
        return result
    }
    
    async getTargetURLsWithKeyword() {
        await this.page.goto(`https://twitter.com/search?f=users&vertical=default&q=${this.keyword}&src=typd`)
        const linkSelector = '.GridTimeline-items > .Grid > .Grid-cell .fullname'
        await this.page.waitForSelector(linkSelector)
        return this.page.evaluate((selector) => {
            const elementList = document.querySelectorAll(selector)
            return Array.from(elementList, element => element.href)
        }, linkSelector)
    }
    
    async clickFollowButtons(targetURLs) {
        const followButtonSelector = (i, j) => `.GridTimeline-items > .Grid:nth-child(${i}) > .Grid-cell:nth-child(${j}) .EdgeButton:nth-child(1)`
        const counts = {}
        let counter = 0
        for (let userID = 0; userID < 18; userID += 1) {
            const targetURL = targetURLs[userID]
            counts[targetURL] = { success: 0, fail: 0 }
            await this.page.goto(`${targetURL}/followers`)
            
            let skipFlag = false
            let timeoutCount = 0
            let i = 0
            for (;;) {
                i += 1
                for (let j = 1; j <= 6; j += 1) {
                    try {
                        await this.page.waitForSelector(
                            followButtonSelector(i, j),
                            { timeout: 5000 }
                        )
                        await this.page.click(followButtonSelector(i, j))
                        counts[targetURL].success += 1
                        counter += 1
                        if (counter >= this.count) {
                            return counts
                        }
                    } catch (err) {
                        counts[targetURL].fail += 1
                        logging.info(`fail to follow\ntargetURL: ${targetURL}\ntarget: ${j + (i - 1) * 6}\n${err}`)
                        
                        if (err.name === 'TimeoutError') {
                            await this.browser.close()
                            await this.init()
                            await this.page.goto(`${targetURL}/followers`)
                            timeoutCount += 1
                        }
                        
                        if (counts[targetURL].fail >= 10 || timeoutCount >= 2) {
                            skipFlag = true
                            break
                        }
                    }
                }
                if (skipFlag) {
                    break
                }
            }
        }
        return counts
    }
}
