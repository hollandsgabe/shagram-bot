require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const dedent = require("dedent");

const { TELEGRAM_BOT_TOKEN, AUDD_API_KEY, ONLINECONVERT_API_KEY } = process.env;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  console.log(`New message from ${chatId} OK!`);

  if (msg.voice) {
    const { file_id } = msg.voice;

    bot.sendMessage(chatId, "Audio received! Processing... 🎧");

    try {
      const { data } = await axios.get(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${file_id}`
      );
      const { file_path } = await data.result;

      await console.log("Extraction OK! " + file_path);

      try {
        const { data } = await axios.post(
          `https://api2.online-convert.com/jobs`,
          {
            input: [
              {
                type: "remote",
                source: `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file_path}`,
              },
            ],
            conversion: [
              {
                target: "mp3",
              },
            ],
          },
          {
            headers: {
              "x-oc-api-key": ONLINECONVERT_API_KEY,
            },
          }
        );

        const { id } = await data;

        await console.log("Upload OK! " + id);

        let converted = false;
        let uri = "";

        while (!converted) {
          try {
            const { data } = await axios.get(
              `https://api2.online-convert.com/jobs/${id}`,
              {
                headers: {
                  "x-oc-api-key": ONLINECONVERT_API_KEY,
                },
              }
            );
            const { output } = await data;

            if (output.length > 0) {
              converted = true;
              uri = output[0].uri;
            }
          } catch (e) {
            console.log(e);
          }
        }

        console.log("Conversion OK! " + uri);

        try {
          const { data } = await axios.post("https://api.audd.io/", {
            url: uri,
            return: "timecode,apple_music,deezer,spotify",
            api_token: AUDD_API_KEY,
          });

          await console.log(data);

          if (data.status === "success" && data.result) {
            const res = dedent`
              I found something! 🥳

              Title: ${data.result.title}
              Artist: ${data.result.artist}
              Album: ${data.result.album}
              Release date: ${data.result.release_date}
              ${
                data.result.apple_music
                  ? `\nListen on [Apple Music](${data.result.apple_music.url})`
                  : ``
              }
              ${
                data.result.spotify
                  ? `Listen on [Spotify](${data.result.spotify.external_urls.spotify})`
                  : ``
              }
              ${
                data.result.deezer
                  ? `Listen on [Deezer](${data.result.deezer.link})`
                  : ``
              }

              Published by ${data.result.label}
            `;

            bot.sendMessage(chatId, res, { parse_mode: "Markdown" });
          } else {
            bot.sendMessage(chatId, "I couldn't find any similar song. 🙁");
          }
        } catch (e) {
          bot.sendMessage(
            chatId,
            "Hm, I'm having trouble identifying this song... Try recording again! 🤔"
          );
        }
      } catch (e) {
        bot.sendMessage(
          chatId,
          "Sorry, something went wrong with the request. Please try again later! 🤒"
        );
      }
    } catch (e) {
      bot.sendMessage(
        chatId,
        "Sorry, something went wrong with the request. Please try again later! 🤒"
      );
    }
  } else if (msg.text === "/start") {
    bot.sendMessage(
      chatId,
      dedent`
      Hi, ${msg.from.first_name}! Welcome to the Sound Bot. 😁

      Record any currently playing song. I'll listen to it, and look up as much information as possible about it! 🎵
    `
    );
  } else {
    bot.sendMessage(chatId, "Sorry, I can only handle audio files! 🔊");
  }
});