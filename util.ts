export const yoink = (userAndRepo: `${string}/${string}`, file: string) => {
  const yoink = {
    async response() {
      const response = await fetch(`https://github.com/${userAndRepo}/raw/refs/heads/main/${file}`)
      if (!response.ok) {
        throw new Error(`Fetch error: ${response.statusText}`)
      }

      return response
    },

    stream: {
      async get() {
        const stream = (await yoink.response()).body
          ?.pipeThrough(new TextDecoderStream())
          .getReader()

        if (!stream) {
          throw new Error('Failed to get stream from response body')
        }

        return stream
      },

      async process<TValue>(callback: (value: TValue) => Bun.MaybePromise<void>) {
        const stream = await this.get()

        while (true) {
          const { value, done } = await stream.read()
          if (done) {
            break
          }

          await callback(value as TValue)
        }
      },

      async eachLine(callback: (line: string) => Bun.MaybePromise<void>) {
        let partialLine = ''

        await this.process<string>(async value => {
          const lines = (partialLine + value).split('\n')
          partialLine = lines.pop() || ''

          for (const line of lines) {
            await callback(line)
          }
        })
      },
    },
  }

  return yoink
}
