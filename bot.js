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
var ignoreCount = 0
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

Bot.on('gift', event => {
    var tier = event.msg_param_sub_plan / 1000   
    msg = `/me ${event.display_name} 送了一份層級 ${tier} 訂閱給 ${event.msg_param_recipient_display_name} (${event.msg_param_recipient_user_name})！他/她已經在本頻道送出了 ${event.msg_param_sender_count} 份贈禮訂閱！`
    if(ignoreCount > 0){
        ignoreCount--
        return
    }
    waitingList.push(msg)
})

Bot.on('mysterygift', event => {
    var tier = event.msg_param_sub_plan / 1000
    ignoreCount = event.msg_param_mass_gift_count
    msg = `/me ${event.display_name} 送了 ${event.msg_param_mass_gift_count} 份層級 ${tier} 訂閱給社群！他/她已經在本頻道送出了 ${event.msg_param_sender_count} 份贈禮訂閱！`
    waitingList.push(msg)
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
                            bot_msg = msgTemplate.replace('{name}', temp.name)
                            bot_msg = bot_msg.replace('{amount}', temp.amount)
                            bot_msg = "/me " + bot_msg + " " + temp.msg
                            waitingList.push(bot_msg)
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
                        bot_msg = msgTemplate.replace('{name}', temp.name)
                        bot_msg = bot_msg.replace('{amount}', temp.amount)
                        bot_msg = "/me " + bot_msg + " " + temp.msg
                        waitingList.push(bot_msg)
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
        bot_msg = waitingList[0]
        Bot.say(bot_msg)
        waitingList.splice(0, 1)
    }
}
  
setInterval(donateCheaker, 2000);
setInterval(msgSender, 2000);