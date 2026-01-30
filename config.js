module.exports = {
  token: process.env.DISCORD_TOKEN || "YOUR_DISCORD_BOT_TOKEN_HERE",
  clientId: "1460208091428819171",

  adminRoleId: ["1456135706979336253"], // Masukkan ID Role Admin di sini
  ticketAdminRoleId: ["1456135706979336253","1461947960924311552"], // Masukkan ID Role Helper/Ticket Order di sini
  logChannelId: "1460627494033166466",
  orderChannelId: "1451004823905370223", // ID channel Order-Vip
  ticketCategoryId: "1461156749368361001", // Ganti dengan ID kategori ticket yang valid dari server Anda

  timezone: "Asia/Jakarta",
  openHour: 6,
  closeHour: 23,
  mainAdminId: "845347986708602900",
  footer: "© HANGKERYUZZ",

  roles: {
    x8_6j: "1460271659289411698", // Ganti dengan ID Role VIP 6 Jam Anda
    x8_12j: "1460271776604098672", // Ganti dengan ID Role VIP 12 Jam Anda
    x8_24j: "1460271891729223710" // Ganti dengan ID Role VIP 24 Jam Anda
  },

  channels: {
    x8_6j: "https://discord.com/channels/1328994791552159828/1460395238890799226", // Link Channel VIP 6 Jam
    x8_12j: "https://discord.com/channels/1328994791552159828/1460395331492774004", // Link Channel VIP 12 Jam
    x8_24j: "https://discord.com/channels/1328994791552159828/1460395397426974790" // Link Channel VIP 24 Jam
  },

  payment: {
    dana: "087843255054 (A/N HANGKERYUZZ)",
    gopay: "087843255054 (A/N HANGKERYUZZ)",
    qrisImage: "attachment://qris.png",
    terms: [
      "1. Pembayaran harus sesuai dengan nominal yang tertera.",
      "2. Kirim bukti pembayaran yang sah ke channel ticket ini.",
      "3. Proses aktivasi dilakukan secara manual oleh admin setelah pengecekan.",
      "4. refund? 50% setelah pembayaran dikonfirmasi."
    ]
  },
  openSlotText: "***OPEN SLOT SERVER VIP X8 6/12/24JAM BUAT EVENT MINGGU ESOK, GASIIN ORDER GAISS TEKAN TOMBOL DI ATAS BUAT ORDER, JIKA BINGUNG ORDER CEK PANDUAN DI ATAS Atau DM  <@&1451006643272941669> \n@everyone***"
};
