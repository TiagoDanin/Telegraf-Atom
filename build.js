const Telegraf = require('telegraf')
const TelegrafTest = require('telegraf-test')
const fs = require('fs')

const bot = new Telegraf('')
const test = new TelegrafTest({
	url: 'http://127.0.0.1:3000/build'
})

const ingore = [
	'constructor',
	'assert',
	'chatId',
	'messageId',
	'callbackQueryId',
	'inlineMessageId'
]

//https://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically/29123804#29123804
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
var ARGUMENT_NAMES = /(?:^|,)\s*([^\s,=]+)/g
const getFunctionParameters = (func, isCtx) => {
	var fnStr = func.toString().replace(STRIP_COMMENTS, '')
	var argsList = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')'))
	var result = argsList.match(ARGUMENT_NAMES)

	if(result === null) {
		return []
	}
	else {
		var stripped = []
		var n = 0
		for (var i = 0; i < result.length; i++) {
			var name = result[i].replace(/[\s,]/g, '')
			if (name == 'extra') {
				name = '{}'
			}
			if (isCtx && !ingore.includes(name)) {
				n++
				stripped.push(`\${${(n)}:${name}}`)
			}
		}
		return stripped
	}
}

const createFuncText = (f, prefix, funcName) => {
	if (ingore.includes(funcName)) {
		return {
			text: `${prefix}${funcName}`,
			type: 'variable',
		}
	}
	let func = f[funcName]
	if (typeof func == 'function') {
		var params = getFunctionParameters(func)
		if (params.length == 0) {
			func = funcName.replace(/^reply(with)*(html|markdown)*/i, 'send')
			if (func == 'send') {
				func = 'sendMessage'
			}
			params = getFunctionParameters(bot.telegram[func], true)
		}
		return {
			snippet: `${prefix}${funcName}(${params.join(', ')})`,
			type: 'function'
		}
	}
	return {
		text: `${prefix}${funcName}`,
		type: 'variable'
	}
}

var tgFunc = Object.getOwnPropertyNames(Object.getPrototypeOf(bot.telegram))
bot.hears(/start/i, async (ctx) => {
	var rBot = tgFunc.map((funcName) => createFuncText(bot.telegram, 'bot.telegram.', funcName))

	tgFunc = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx))
	var rCtx = tgFunc.map((funcName) => createFuncText(ctx, 'ctx.', funcName))

	const output = [
		{
			snippet: "bot.start((ctx) => {})",
			type: 'function'
		},
		{
			snippet: "bot.help((ctx) => {})",
			type: 'function'
		},
		{
			snippet: "bot.on([], (ctx) => {})",
			type: 'function'
		},
		{
			snippet: "bot.hears(/regex/i, (ctx) => {})",
			type: 'function'
		},
		{
			snippet: "bot.command([], (ctx) => {})",
			type: 'function'
		},
		{
			snippet: "bot.startPolling()",
			type: 'function'
		},
		{
			snippet: "bot.startWebhook(secretPath, tlsOptions, port)",
			type: 'function'
		},
		{
			snippet: "bot.use((ctx, next) => { return next(ctx) })",
			type: 'function'
		},
		{
			snippet: "bot.catch((err) => {})",
			type: 'function'
		},
		...rBot,
		...rCtx
	]
	await fs.writeFileSync('allMethods.json', JSON.stringify(output))
	process.exit()
	return
})

test.startServer()
bot.startWebhook('/build', null, 3000)
test.sendMessage({ text: '/start' })
