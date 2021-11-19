import ws from 'websocket'
import protobuf from 'protobufjs'
import events from 'events'
import path from 'path'
import Long from 'long'

export type ICallback = (ticker: any) => any

export class YahooFinanceTicker {
  client: ws.client
  connection: ws.connection
  protoTicker: protobuf.Type
  eventEmitter: events.EventEmitter = new events.EventEmitter()
  callbackFn: ICallback
  logging: boolean = false

  private initClient = () => {
    return new Promise((resolve) => {
      this.client = new ws.client()
      this.client.connect('wss://streamer.finance.yahoo.com/')
      this.client.on('connect', (connection) => {
        this.logger('Yahoo Finance WS Connected')
        this.connection = connection
        resolve(true)
        connection.on('message', this.handleConnectionMessage)
      })

      this.client.on('connectFailed', function (error) {
        this.logger('Connect Error: ' + error.toString())
      })
    })
  }

  private handleConnectionMessage = (message: ws.IMessage) => {
    this.logger('Stream Message Received')
    if (message.type === 'utf8') {
      const ticker = this.protoTicker.decode(
        Buffer.from(message.utf8Data, 'base64'),
      )
      const tickerObj = this.protoTicker.toObject(ticker, {
        longs: String,
        enums: String,
      })
      this.eventEmitter.emit('ticker', tickerObj)
      if (!!this.callbackFn) {
        this.callbackFn(tickerObj)
      }
    }
  }

  private logger = (...args: any) => {
    if (this.logging) {
      console.log(...args)
    }
  }

  private loadProto = async () => {
    const root = await protobuf.load(
      path.join(__dirname, '../', 'yticker.proto'),
    )
    this.protoTicker = root.lookupType('yticker')
  }

  public subscribe = async (symbols: string[], callback?: ICallback) => {
    if (!this.protoTicker) {
      await this.loadProto()
    }
    if (!this.client || !this.connection) {
      await this.initClient()
    }
    this.connection.sendUTF(
      JSON.stringify({
        subscribe: symbols,
      }),
    )
    if (!!callback) {
      this.callbackFn = callback
    }
    return this.eventEmitter
  }

  public unsubscribe = () => {
    if (this.connection && this.connection.connected) {
      this.connection.close()
      this.logger('Yahoo Finance WS Connection Closed')
    }
  }

  public setLogging = (bool: boolean) => {
    this.logging = bool
  }
}

export default YahooFinanceTicker
