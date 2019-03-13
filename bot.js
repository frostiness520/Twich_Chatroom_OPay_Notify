const TwitchBot = require('twitch-bot')
var request = require('request');
var config = require('./conf.json');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
var channelJoined = false
var OPayObserverStatus = true
var streamlabsObserverStatus = true
var handledList = []
var waitingList = []
var msgTemplate = '{name} 贊助了{amount}'
var setting = config[config.targetSettingFile]

const Bot = new TwitchBot({
  username: setting.username,
  oauth: setting.oath,
  channels: [setting.channel]
})

Bot.on('join', channel => {
    console.log(`Joined channel: ${channel}`)
    channelJoined = true
})

Bot.on('part', channel => {
    console.log(`part channel: ${channel}`)
    channelJoined = false
    setTimeout(function(){Bot.join(setting.channel)},3000)
})

Bot.on('error', err => {
  console.log(err)
})

Bot.on('message', chatter => {
  if(chatter.username === setting.modName && chatter.message === setting.testCommand) {
    Bot.say(`運行狀態=>OPay:${OPayObserverStatus}, Paypal:${streamlabsObserverStatus}`)
  }
})

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
                            waitingList.push(temp)
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
                        waitingList.push(temp)
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
        element = waitingList[0]
        bot_msg = msgTemplate.replace('{name}', element.name)
        bot_msg = bot_msg.replace('{amount}', element.amount)
        bot_msg = "/me " + bot_msg + " " + element.msg
        Bot.say(bot_msg)
        waitingList.splice(0, 1)
    }
}
  
setInterval(donateCheaker, 2000);
setInterval(msgSender, 2000);