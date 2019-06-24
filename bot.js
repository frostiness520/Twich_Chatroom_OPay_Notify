const tmi = require("tmi.js");
var request = require('request');
var config = require('./conf.json');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
var channelJoined = false
var OPayObserverStatus = true
var streamlabsObserverStatus = true
var handledList = []
var waitingList = []
var pmList = []
var gifteeList = []
var ignoreCount = 0
var msgTemplate = '{name} 贊助了{amount}'
var setting = config[config.targetSettingFile]
var viewers = 0
var hours = '0'
var title = ''

let options = {
    options: {
        debug: false
    },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: setting.username,
        password: setting.oath
    },
    channels: [ setting.channel ]
};
const client = new tmi.client(options);
client.connect();

viewersChecker()
queryHours()
checker()

function getSubTier(subPlan){
    if(subPlan.indexOf('1000') >= 0){
        return 1
    }
    else if(subPlan.indexOf('2000') >= 0){
        return 2
    }
    else if(subPlan.indexOf('3000') >= 0){
        return 3
    }
    else{
        return 'prime'
    }
}

function pushCheckIgnoreCount(msg, gifter){
    if(ignoreCount > 0){
        setTimeout(pushCheckIgnoreCount, 1000, msg, gifter)
        return
    }
    waitingList.push(msg)
    msg = ''
    gifteeList.forEach(function(giftee) {
        msg = msg + giftee + ', '
    }, this)
    msg = gifter + ' 對 ' + msg + '說：請問你要加入金魚神教嗎？ (Y/y)'
    waitingList.push(msg)
}

client.on("join", (channel, username, self) => {
    if(!self)
      return;
      console.log(`Joined channel: ${channel}`)
      channelJoined = true
  });

client.on("disconnected", (reason) => {
    console.log('disconnected')
    channelJoined = false
});

client.on("message", (channel, userstate, message, self) => {
    if(userstate["message-type"] == "action" || userstate["message-type"] == "chat"){
        if(userstate["username"] === setting.modName && message === setting.testCommand) {
            client.say(setting.channel, `運行狀態=>OPay:${OPayObserverStatus}, Paypal:${streamlabsObserverStatus}`);
        }
        else if(message === '!人數'){
            let shouldPush = true
            waitingList.forEach(function(element){
                if(element.includes('目前聊天室人數')){
                    shouldPush = false
                }
            })
            if(shouldPush){
                waitingList.push(`目前聊天室人數:${viewers}`)
            }
        }
        else if(message === '!本月時數'){
            let shouldPush = true
            waitingList.forEach(function(element){
                if(element.includes('已實況')){
                    shouldPush = false
                }
            })
            if(shouldPush){
                let t = new Date()
                let y = t.getTime() - 3600000
                let yt = new Date(y)
                let s =  (yt.getMonth()+1) + '/' + yt.getDate()
                waitingList.push(`累積至${s}的現在為止，已實況了${hours}小時`)
            }    
        }
        else if(message === '!標題'){
            let shouldPush = true
            waitingList.forEach(function(element){
                if(element.includes('實況標題:')){
                    shouldPush = false
                }
            })
            if(shouldPush){
                waitingList.push(`實況標題: ${title}`)
            }
        }
    }

});

client.on("subgift", (channel, username, streakMonths, recipient, methods, userstate) => {
    console.log('subgift')
    let tier = getSubTier(String(methods["plan"]))
    let senderCount = ~~userstate["msg-param-sender-count"];
    msg = `${username} 送了一份層級 ${tier} 訂閱給 ${userstate["msg-param-recipient-display-name"]} (${userstate["msg-param-recipient-user-name"]})！他/她已經在本頻道送出了 ${senderCount} 份贈禮訂閱！`
    if(ignoreCount > 0){
        gifteeList.push(`${userstate["msg-param-recipient-display-name"]} (${userstate["msg-param-recipient-user-name"]})`)
        ignoreCount--
        return
    }
    waitingList.push(msg)
});

client.on("submysterygift", (channel, username, numbOfSubs, methods, userstate) => {
    console.log('mysterygift')
    let senderCount = ~~userstate["msg-param-sender-count"];
    gifteeList = []
    let tier = getSubTier(String(methods["plan"]))
    ignoreCount = numbOfSubs
    setTimeout(function(){ignoreCount = 0}, 10000)
    msg = `${username} 送了 ${numbOfSubs} 份層級 ${tier} 訂閱給社群！他/她已經在本頻道送出了 ${senderCount} 份贈禮訂閱！`
    pushCheckIgnoreCount(msg, username)
});

client.on("giftpaidupgrade", (channel, username, sender, userstate) => {
    msg = `${username} 將繼續使用 ${sender} 贈送的贈禮訂閱!`
    waitingList.push(msg)
});

//init streamLabs donate list
request.get(
    'https://www.twitchalerts.com/api/donations?access_token=' + setting.streamLabsToken,
    { json: { key: 'value' } },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body.donations.forEach(function(element) {
                if(!handledList.includes(element.id)){
                    handledList.push(element.id)
                }
            }, this);
            streamlabsObserverStatus = true
        }
        else{
            streamlabsObserverStatus = false
        }
    }
)

function donateCheaker() {
    request.post(
        'https://payment.opay.tw/Broadcaster/CheckDonate/' + setting.OPayKey,
        { json: { key: 'value' } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                msgTemplate = entities.decode(body.settings.MsgTemplate)
                if(body.lstDonate.length > 0){
                    body.lstDonate.forEach(function(element) {
                        if(!handledList.includes(element.donateid)){
                            handledList.push(element.donateid)
                            var temp = {}
                            temp.name = element.name
                            temp.amount = "TWD " + element.amount
                            temp.msg = element.msg
                            let bot_msg = msgTemplate.replace('{name}', temp.name)
                            bot_msg = bot_msg.replace('{amount}', temp.amount)
                            bot_msg = bot_msg + " " + temp.msg
                            waitingList.push(bot_msg)
                            pmList.push(bot_msg)
                        }
                    })
                }
                OPayObserverStatus = true
            }
            else{
                OPayObserverStatus = false
            }
        }
    )
    request.get(
        'https://www.twitchalerts.com/api/donations?access_token=' + setting.streamLabsToken,
        { json: { key: 'value' } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                body.donations.forEach(function(element) {
                    if(!handledList.includes(element.id)){
                        handledList.push(element.id)
                        var temp = {}
                        temp.name = element.donator.name
                        temp.amount = element.currency + element.amount_label.replace('$', ' ')
                        temp.msg = element.message
                        let bot_msg = msgTemplate.replace('{name}', temp.name)
                        bot_msg = bot_msg.replace('{amount}', temp.amount)
                        bot_msg = bot_msg + " " + temp.msg
                        waitingList.push(bot_msg)
                        pmList.push(bot_msg)
                    }
                }, this);
                streamlabsObserverStatus = true
            }
            else{
                streamlabsObserverStatus = false
            }
        }
    )
}

function msgSender(){
    if(waitingList.length > 0 && channelJoined){
        let bot_msg = waitingList[0]
        client.say(setting.channel, '/me ' + bot_msg);
        waitingList.splice(0, 1)
        if(pmList.length > 0){
            setTimeout(function(){
                bot_msg = pmList[0]
                client.say(setting.channel, '/w ' + config.targetSettingFile + ' ' + bot_msg);
                pmList.splice(0, 1)
            },1000)
        }
    }
}

function viewersChecker(){
    request.get(
        'http://tmi.twitch.tv/group/user/vocaljudy/chatters',
        { json: { key: 'value' } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if (body.chatter_count) {
                    viewers = body.chatter_count
                }
            }
        }
    )
}

function checker(){
    request({
      headers: {
        'Client-ID': '4z6vya336cojem0mpzdqqzbghkv23j',
        'Accept': 'application/vnd.twitchtv.v5+json'
      },
      uri: 'https://api.twitch.tv/kraken/channels/162505127',
      method: 'GET'
    }, function (err, res, body) {
      if (!err && res.statusCode == 200) {
        let channel = JSON.parse(body)
        if (channel && channel.status) {
            title = channel.status
        }
      }
    });
};



async function queryHours(){
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    const page = await browser.newPage();
    await page.goto('https://twitchtracker.com/vocaljudy/statistics', {waitUntil: 'load', timeout: 60000});
    
    let $ = cheerio.load(await page.content())
    let data = []
    $('#table-statistics tbody tr').each(function(i, elem) {
      data.push($(this).text().split('\n'))
    })
    hours = data[0][3].replace(' hrs','')
    await browser.close();
}
  
setInterval(donateCheaker, 2000);
setInterval(msgSender, 2000);
setInterval(viewersChecker, 30000);
setInterval(queryHours, 600000);
setInterval(checker, 10000);