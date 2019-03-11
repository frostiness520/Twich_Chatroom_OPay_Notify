const TwitchBot = require('twitch-bot')
var request = require('request');
var config = require('./conf.json');
var channelJoined = false
var handledList = []
var waitingList = []
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
    Bot.say('運作中')
  }
})


function donateCheaker() {
    request.post(
        'https://payment.opay.tw/Broadcaster/CheckDonate/' + setting.OPayKey,
        { json: { key: 'value' } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if(body.lstDonate.length > 0){
                    body.lstDonate.forEach(function(element) {
                        if(!handledList.includes(element.donateid)){
                            handledList.push(element.donateid)
                            waitingList.push(element)
                        }
                    })
                }
            }
        }
    )
}

function msgSender(){
    if(waitingList.length > 0 && channelJoined){
        element = waitingList[0]
        bot_msg = "" + element.name + " 贊助了$" + element.amount + "，" + element.msg
        Bot.say(bot_msg)
        waitingList.splice(0, 1)
    }
}
  
setInterval(donateCheaker, 1500);
setInterval(msgSender, 2000);