const crypto = require("crypto");
const { Client } = require("./libfb-monkeypatched/dist");
const fs = require("fs");

let verifier = null;
let client = new Client();

const recoverCache = () => {
  try {
    const cached = JSON.parse(
      fs.readFileSync("/tmp/.workchat_credentials_cache").toString()
    );
    const credentialsExpiration = 1000 * 60 * 60 * 72; // 3 days
    if (Date.now() - cached.timestamp > credentialsExpiration) return;
    client.loggedIn = true;
    client.httpApi.token = cached.httpApi;
    client.session.tokens = cached.session;

    // TODO: lines below are basically a copy-paste from the Client.js doLogin function in libfb,
    // extracting it to a common function would probably be better
    client.mqttApi.on("publish", publish => {
      if (publish.topic === "/send_message_response") {
        const response = JSON.parse(publish.data.toString("utf8"));
        client.mqttApi.emit("sentMessage:" + response.msgid, response);
      }
      if (publish.topic === "/t_ms")
        client.handleMS(publish.data.toString("utf8"));
    });
    client.mqttApi.on("connected", async () => {
      let { viewer } = await client.httpApi.querySeqId();
      const seqId = viewer.message_threads.sync_sequence_id;
      client.seqId = seqId;
      if (!client.session.tokens.syncToken) {
        await client.createQueue(seqId);
        return;
      }
      await client.createQueue(seqId);
    });
    client.mqttApi.connect(client.session.tokens, client.session.deviceId);
    console.log("Credentials retrieved from cache");
  } catch (e) {}
};
recoverCache();

const base64URLEncode = str => {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const sha256 = buffer => {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest();
};

const loginStart = rawEmail => {
  verifier = base64URLEncode(crypto.randomBytes(32));

  const challenge = base64URLEncode(sha256(verifier));
  const req_id = base64URLEncode(crypto.randomBytes(3));
  const email = encodeURIComponent(rawEmail);

  const responseUrl = encodeURIComponent("fb-workchat-sso://sso");
  return `https://m.facebook.com/work/sso/mobile?app_id=312713275593566&response_url=${responseUrl}&request_id=${req_id}&code_challenge=${challenge}&email=${email}`;
};

const isLoggedIn = () => {
  return client.loggedIn;
};

const loginAuth = (uid, nonce) => {
  return client.login(uid, `${nonce}:${verifier}`).then(() => {
    fs.writeFileSync(
      "/tmp/.workchat_credentials_cache",
      JSON.stringify({
        session: client.session.tokens,
        httpApi: client.httpApi.token,
        timestamp: Date.now()
      })
    );
  });
};

module.exports = { loginStart, loginAuth, isLoggedIn, client };