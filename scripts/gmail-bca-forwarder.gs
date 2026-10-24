/**
 * Catatku — Gmail → Webhook forwarder untuk email notifikasi BCA.
 *
 * Cara pakai (ringkas):
 * 1. Buka https://script.google.com → New project.
 * 2. Tempel seluruh file ini.
 * 3. Ganti WEBHOOK di bawah (URL Vercel + ?secret=INBOUND_EMAIL_SECRET).
 * 4. Jalankan installTrigger() sekali (authorize Gmail + external request).
 * 5. Jalankan forwardBcaEmails() untuk uji, lalu cek Kotak Masuk Catatku.
 *
 * Catatan: email BCA dari myBCA umumnya HTML (plain text kosong), jadi
 * forwarder mengirim kedua versi: getPlainBody() dan getBody().
 *
 * Panduan lengkap: docs/BCA-INTEGRATION.md
 */

const CONFIG = {
  // Contoh: https://catatku-dun.vercel.app/api/inbound/email?secret=xxxxx
  WEBHOOK: "https://catatku-dun.vercel.app/api/inbound/email?secret=GANTI_SECRET",
  // Cari email dari BCA dalam 7 hari terakhir.
  QUERY: "from:(bca@bca.co.id) newer_than:7d",
  MAX_THREADS: 50,
};

function forwardBcaEmails() {
  const webhook = CONFIG.WEBHOOK;
  if (!webhook || webhook.includes("GANTI_SECRET")) {
    Logger.log("Isi CONFIG.WEBHOOK dengan URL webhook + secret terlebih dahulu.");
    return;
  }

  const properties = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(CONFIG.QUERY, 0, CONFIG.MAX_THREADS);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const key = "sent:" + message.getId();
      if (properties.getProperty(key)) {
        skipped += 1;
        return;
      }

      const payload = {
        from: message.getFrom(),
        to: message.getTo(),
        subject: message.getSubject(),
        text: message.getPlainBody(),
        html: message.getBody(),
        messageId: message.getId(),
      };

      try {
        const response = UrlFetchApp.fetch(webhook, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });
        const code = response.getResponseCode();
        if (code >= 200 && code < 300) {
          properties.setProperty(key, "1");
          sent += 1;
        } else {
          failed += 1;
          Logger.log("HTTP " + code + ": " + response.getContentText().slice(0, 300));
        }
      } catch (error) {
        failed += 1;
        Logger.log("Gagal mengirim: " + error);
      }
    });
  });

  Logger.log("Selesai. Terkirim: " + sent + ", dilewati: " + skipped + ", gagal: " + failed);
}

/** Cek konfigurasi & trigger yang terpasang. */
function checkSetup() {
  Logger.log("Webhook terisi: " + !CONFIG.WEBHOOK.includes("GANTI_SECRET"));
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log("Trigger terpasang: " + triggers.length);
  triggers.forEach((trigger) => Logger.log("- " + trigger.getHandlerFunction()));
}

/** Pasang trigger otomatis tiap 10 menit (jalankan sekali). */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "forwardBcaEmails") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("forwardBcaEmails").timeBased().everyMinutes(10).create();
  Logger.log("Trigger otomatis tiap 10 menit dipasang.");
}
