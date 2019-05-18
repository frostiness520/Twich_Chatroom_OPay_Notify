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
var pmList = []
var gifteeList = []
var ignoreCount = 0
var msgTemplate = '{name} 贊助了{amount}'
var setting = config[config.targetSettingFile]
var viewers = 0

const Bot = new TwitchBot({
  username: setting.username,
  oauth: setting.oath,
  channels: [setting.channel]
})

viewersChecker()

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
  else if(chatter.message === '!人數'){
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
})

Bot.on('gift', event => {
    var tier = getSubTier(String(event.msg_param_sub_plan))
    msg = `${event.display_name} 送了一份層級 ${tier} 訂閱給 ${event.msg_param_recipient_display_name} (${event.msg_param_recipient_user_name})！他/她已經在本頻道送出了 ${event.msg_param_sender_count} 份贈禮訂閱！`
    if(ignoreCount > 0){
        gifteeList.push(`${event.msg_param_recipient_display_name} (${event.msg_param_recipient_user_name})`)
        ignoreCount--
        return
    }
    waitingList.push(msg)
})

Bot.on('continueSub', event => {
    msg = `${event.display_name} 將繼續使用 ${event.msg_param_sender_name} 贈送的贈禮訂閱!`
    waitingList.push(msg)
})

Bot.on('subscription', event => {
    console.log('subscription plan:' + event.msg_param_sub_plan)
})

Bot.on('mysterygift', event => {
    gifteeList = []
    var tier = getSubTier(String(event.msg_param_sub_plan))
    ignoreCount = event.msg_param_mass_gift_count
    setTimeout(function(){ignoreCount = 0}, 10000)
    msg = `${event.display_name} 送了 ${event.msg_param_mass_gift_count} 份層級 ${tier} 訂閱給社群！他/她已經在本頻道送出了 ${event.msg_param_sender_count} 份贈禮訂閱！`
    pushCheckIgnoreCount(msg, event.display_name)
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
                        bot_msg = msgTemplate.replace('{name}', temp.name)
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
        bot_msg = waitingList[0]
        Bot.say('/me ' + bot_msg)
        waitingList.splice(0, 1)
        if(pmList.length > 0){
            setTimeout(function(){
                bot_msg = pmList[0]
                Bot.say('/w ' + config.targetSettingFile + ' ' + bot_msg)
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
            viewers = body.chatter_count
        }
    )
}
  
setInterval(donateCheaker, 2000);
setInterval(msgSender, 2000);
setInterval(viewersChecker, 30000);