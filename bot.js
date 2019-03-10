const TwitchBot = require('twitch-bot')
var request = require('request');
var channelJoined = false
var handledList = []
var waitingList = []
const Bot = new TwitchBot({
  username: 'UserNameHere',
  oauth: 'oauth get from https://twitchapps.com/tmi/',
  channels: ['#vocaljudy']
})

Bot.on('join', channel => {
    console.log(`Joined channel: ${channel}`)
    channelJoined = true
})

Bot.on('error', err => {
  console.log(err)
})

Bot.on('message', chatter => {
  if(chatter.message === '!test') {
    Bot.say('Command executed! PogChamp')
  }
})


function donateCheaker() {
    request.post(
        'https://payment.opay.tw/Broadcaster/CheckDonate/0D1F1C6F1F9A13F07BC733D53732DE9C',
        { json: { key: 'value' } },
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if(body.lstDonate.length > 0){
                    body.lstDonate.forEach(function(element) {
                        if(channelJoined && !handledList.includes(element.donateid)){
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
    if(waitingList.length > 0){
        element = waitingList[0]
        bot_msg = "" + element.name + " 贊助了$" + element.amount + "，" + element.msg
        Bot.say(bot_msg)
        waitingList.splice(0, 1)
    }
}
  
setInterval(donateCheaker, 1500);
setInterval(msgSender, 2000);