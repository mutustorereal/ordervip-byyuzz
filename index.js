const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionsBitField, Events
} = require("discord.js");

const fs = require("fs");
const moment = require("moment-timezone");

const tesseract = require("node-tesseract-ocr");

const config = require("./config");
const products = require("./products");

const tesseractConfig = {
  lang: "eng+ind",
  oem: 1,
  psm: 3,
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const genTicketId = () => {
  const db = loadDB();
  const nextId = (db.tickets.length + 1).toString().padStart(3, '0');
  return nextId;
};
const genInvoiceId = () => "INV-" + Math.random().toString(36).substr(2, 9).toUpperCase();

const loadDB = () => JSON.parse(fs.readFileSync("./database.json"));
const saveDB = db => fs.writeFileSync("./database.json", JSON.stringify(db, null, 2));

const isOpen = () => {
  const h = moment().tz(config.timezone).hour();
  return h >= config.openHour && h < config.closeHour;
};

const getOrderEmbed = () => {
  const open = isOpen();
  const now = moment().tz(config.timezone);
  const closeTime = moment().tz(config.timezone).hour(config.closeHour).minute(0).second(0);
  
  let timeLeftStr = "";
  if (open) {
    const diffMs = closeTime.diff(now);
    const duration = moment.duration(diffMs);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    timeLeftStr = `\n⏰ Tutup dalam: **${hours} jam ${minutes} menit**`;
  }

  const productList = Object.values(products).map(p => `• ${p.name} - **${p.price}** <:blueverified:1461165869865500692>`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(open ? 0x00ff88 : 0xff5555)
    .setTitle("🛒 SERVER VIP BY HANGKERYUZZ <:logoyuzz:1460522993074704429>")
    .setDescription(
      open
        ? `Selamat datang! Tekan tombol di bawah untuk membuka ticket order.
            
━━━━━━━━━━━━━━━━━━━━━━
📌 **Daftar Harga VIP <a:vip:1460521870779744297> :**
${productList}
━━━━━━━━━━━━━━━━━━━━━━
⏰ **Jam Operasional :**
${config.openHour}.00 - ${config.closeHour}.00 WIB${timeLeftStr}

📜 **Ketentuan:**
• REFUND? 50% DARI PEMBAYARAN
• JOIN LEWAT KONEKSI/SEARCH PP (BISA REJOIN)

⚠️ *1 user hanya bisa memiliki 1 ticket aktif*`
        : `❌ **ORDER DITUTUP**
⏰ Buka kembali pukul ${config.openHour}.00 WIB`
    )
    .setImage("attachment://banner.jpg")
    .setFooter({ text: config.footer });

  const row = new ActionRowBuilder().addComponents(
    Object.entries(products).map(([id, p]) => {
      const isClosed = p.price.includes("(CLOSE)");
      return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(`🍀 ${p.name}`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(!open || isClosed);
    })
  );

  return { embeds: [embed], components: [row], files: [{ attachment: "./YuzzOrder/banner.jpg", name: "banner.jpg" }] };
};

const updateOrderMessage = async () => {
  const db = loadDB();
  if (db.orderMsg && db.orderMsg.channelId && db.orderMsg.messageId) {
    try {
      const channel = await client.channels.fetch(db.orderMsg.channelId).catch(() => null);
      if (!channel) return;
      
      const message = await channel.messages.fetch(db.orderMsg.messageId).catch(() => null);
      if (!message) return;

      const { embeds, components } = getOrderEmbed();
      await message.edit({ embeds, components });
    } catch (err) {
      if (err.code !== 10008 && err.code !== 10003) {
        console.error("❌ Gagal update pesan order:", err.message);
      }
    }
  }
};

function scheduleNextAnnouncement() {
  if (client.announcementTimeout) clearTimeout(client.announcementTimeout);
  
  const runAnnouncement = async () => {
    if (isOpen()) {
      const db = loadDB();
      const targetChannelId = config.orderChannelId;
      
      if (targetChannelId) {
        try {
          const channel = await client.channels.fetch(targetChannelId);
          if (channel) {
            if (db.lastAnnouncementId) {
              try {
                const prevMsg = await channel.messages.fetch(db.lastAnnouncementId).catch(() => null);
                if (prevMsg) await prevMsg.delete().catch(() => {});
              } catch (err) {}
            }

            const adminMentions = Array.isArray(config.ticketAdminRoleId) 
              ? config.ticketAdminRoleId.map(id => `<@&${id}>`).join(" ")
              : `<@&${config.ticketAdminRoleId}>`;

            const ownerMention = `<@${config.mainAdminId}>`;

            const announcementText = (config.openSlotText || "**OPEN SLOT SERVER VIP X8 6/12/24 JAM\\nTEKAN TOMBOL DI ATAU BUAT ORDER VIP.\\nJIKA BINGUNG ORDER CEK PANDUAN DI ATAS ATAU DM {adminMentions} / <@&1451006643272941669> **\\n@everyone")
              .replace("{adminMentions}", adminMentions)
              .replace("{ownerMention}", ownerMention);

            const newMsg = await channel.send({
              content: announcementText.replace(/\\n/g, '\n')
            });

            db.lastAnnouncementId = newMsg.id;
            saveDB(db);
          }
        } catch (err) {
          console.error("❌ Gagal mengirim pesan berkala:", err.message);
        }
      }
    }
    
    const delay = 30 * 60 * 1000;
    client.announcementTimeout = setTimeout(runAnnouncement, delay);
  };

  runAnnouncement();
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  setInterval(updateOrderMessage, 60000);

  // Hapus pemanggilan manual firstAnnouncement() agar benar-benar hanya 30 menit sekali
  scheduleNextAnnouncement();

  setInterval(async () => {
    const db = loadDB();
    const now = Date.now();
    const EXPIRE_TIME = 20 * 60 * 1000;

    for (let i = db.tickets.length - 1; i >= 0; i--) {
      const ticket = db.tickets[i];
      if (ticket.status === "UNPAID" && !ticket.hasProof && (now - ticket.createdAt) > EXPIRE_TIME) {
        ticket.status = "EXPIRED";
        saveDB(db);

        try {
          for (const [guildId, guild] of client.guilds.cache) {
            const channel = guild.channels.cache.find(c => c.name.includes(ticket.ticketId));
            if (channel) {
              const expireEmbed = new EmbedBuilder()
                .setColor(0xff5555)
                .setTitle("❌ TICKET EXPIRED")
                .setDescription(`Maaf, ticket ID #${ticket.ticketId} telah kedaluwarsa karena tidak ada pembayaran selama 20 menit.`)
                .setImage("attachment://expired.webp")
                .setFooter({ text: config.footer })
                .setTimestamp();

              await channel.send({
                content: `⚠️ <@${ticket.userId}> Ticket Anda telah expired.`,
                embeds: [expireEmbed],
                files: [{ attachment: "./expired.webp", name: "expired.webp" }]
              });
              
              setTimeout(() => channel.delete().catch(() => {}), 10000);
            }
          }
        } catch (err) {
          console.error("❌ Gagal proses expiry:", err.message);
        }
      }
    }
  }, 60000);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { MessageFlags } = require("discord.js");

    if (interaction.commandName === "ping")
      return interaction.reply({ content: `🏓 ${client.ws.ping}ms`, flags: [MessageFlags.Ephemeral] });

    if (interaction.commandName === "help") {
      const subCommand = interaction.options.getSubcommand();
      
      if (subCommand === "order") {
        const helpOrderEmbed = new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("📖 PANDUAN ORDER")
          .setDescription(
            "**CARA ORDER:**\n" +
            "1. Gunakan tombol di panel order untuk membuat ticket.\n" +
            "2. Lakukan pembayaran sesuai nominal ke DANA/GOPAY/QRIS.\n" +
            "3. Kirim bukti transfer di channel ticket.\n" +
            "4. Tunggu admin melakukan verifikasi via `/cek`.\n\n" +
            "**SYARAT & KETENTUAN:**\n" +
            "• Refund hanya 50% jika sudah dikonfirmasi.\n" +
            "• Dilarang melakukan spam ticket.\n" +
            "• Akses VIP berlaku sesuai durasi yang dibeli.\n\n" +
            "**NOTE:**\n" +
            "• Jika belum paham silakan hubungi admin: <@hangkeryuzz>\n\n" +
            "**DEVELOPER:**\n" +
            "• Built with ❤️ by **YUZZ**\n\n" +
            "© 2026 HANGKERYUZZ • ALL RIGHTS RESERVED"
          )
          .setFooter({ text: config.footer });

        return interaction.reply({ embeds: [helpOrderEmbed] });
      }

      if (subCommand === "fitur") {
        const helpFiturEmbed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle("🛠️ BANTUAN FITUR BOT")
          .setDescription(
            "**COMMAND LIST:**\n" +
            "• `/sendteks` - Mengirim panel order (Admin Only).\n" +
            "• `/cek` - Verifikasi pembayaran dalam ticket (Admin Only).\n" +
            "• `/chat` - Mengirim pesan atas nama bot.\n" +
            "• `/ping` - Cek latensi bot.\n" +
            "• `/help order` - Panduan cara melakukan pembelian.\n" +
            "• `/help fitur` - Bantuan daftar perintah ini.\n" +
            "• `/setting` - Manajemen produk (Admin Only).\n\n" +
            "**KETENTUAN COMMAND:**\n" +
            "• Gunakan command sesuai fungsinya.\n" +
            "• Command admin hanya bisa digunakan oleh role yang sudah dikonfigurasi.\n\n" +
            "**DEVELOPER:**\n" +
            "• Developed by **YUZZ**\n\n" +
            "© 2026 HANGKERYUZZ • ALL RIGHTS RESERVED"
          )
          .setFooter({ text: config.footer });

        return interaction.reply({ embeds: [helpFiturEmbed] });
      }
    }

    if (interaction.commandName === "setting") {
      if (!interaction.guild || !interaction.member) {
        return interaction.reply({ content: "❌ Command ini hanya dapat digunakan di dalam server.", flags: [MessageFlags.Ephemeral] });
      }
      
      const isAdmin = Array.isArray(config.adminRoleId) 
        ? config.adminRoleId.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.roles.cache.has(config.adminRoleId);

      if (!isAdmin)
        return interaction.reply({ content: "❌ Admin only", flags: [MessageFlags.Ephemeral] });

      const subCommand = interaction.options.getSubcommand();

      if (subCommand === "list") {
        const productList = Object.entries(products).map(([id, p]) => `• **${id}**: ${p.name} - ${p.price} (${p.duration} Jam)`).join("\n");
        const embed = new EmbedBuilder()
          .setColor(0x00aaff)
          .setTitle("📦 DAFTAR PRODUK")
          .setDescription(productList || "Belum ada produk.")
          .setFooter({ text: config.footer });
        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
      }

      if (subCommand === "edit") {
        const id = interaction.options.getString("id");
        if (!products[id]) return interaction.reply({ content: "❌ Produk tidak ditemukan.", flags: [MessageFlags.Ephemeral] });

        const nama = interaction.options.getString("nama");
        const harga = interaction.options.getString("harga");
        const durasi = interaction.options.getInteger("durasi");
        const status = interaction.options.getString("status");

        if (nama) products[id].name = nama;
        if (harga) products[id].price = harga;
        if (durasi) products[id].duration = durasi;
        if (status === "close") {
            if (!products[id].price.includes("(CLOSE)")) products[id].price += " (CLOSE)";
        } else if (status === "open") {
            products[id].price = products[id].price.replace(" (CLOSE)", "");
        }

        fs.writeFileSync("./products.js", `module.exports = ${JSON.stringify(products, null, 2)};`);
        await updateOrderMessage();
        return interaction.reply({ content: `✅ Berhasil update produk ${id} dan memperbarui panel order.`, flags: [MessageFlags.Ephemeral] });
      }

      if (subCommand === "add") {
        const id = interaction.options.getString("id");
        const name = interaction.options.getString("nama");
        const price = interaction.options.getString("harga");
        const duration = interaction.options.getInteger("durasi");
        const roleId = interaction.options.getString("role_id");

        products[id] = { name, price, duration, roleId };
        fs.writeFileSync("./products.js", `module.exports = ${JSON.stringify(products, null, 2)};`);
        await updateOrderMessage();
        return interaction.reply({ content: `✅ Berhasil menambah produk ${id} dan memperbarui panel order.`, flags: [MessageFlags.Ephemeral] });
      }

      if (subCommand === "delete") {
        const id = interaction.options.getString("id");
        if (!products[id]) return interaction.reply({ content: "❌ Produk tidak ditemukan.", flags: [MessageFlags.Ephemeral] });
        delete products[id];
        fs.writeFileSync("./products.js", `module.exports = ${JSON.stringify(products, null, 2)};`);
        await updateOrderMessage();
        return interaction.reply({ content: `✅ Berhasil menghapus produk ${id} dan memperbarui panel order.`, flags: [MessageFlags.Ephemeral] });
      }

      if (subCommand === "edit_openslot") {
        const teks = interaction.options.getString("teks");
        config.openSlotText = teks;
        
        // Update file config.js secara manual dengan penanganan karakter spesial
        let configContent = fs.readFileSync("./config.js", "utf8");
        const escapedTeks = teks.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        
        if (configContent.includes("openSlotText:")) {
          configContent = configContent.replace(/openSlotText: ".*"/, `openSlotText: "${escapedTeks}"`);
        } else {
          configContent = configContent.replace(/};\s*$/, `  openSlotText: "${escapedTeks}"\n};`);
        }
        
        fs.writeFileSync("./config.js", configContent);
        
        // Jalankan ulang pengumuman agar teks baru langsung terkirim
        scheduleNextAnnouncement();
        
        return interaction.reply({ content: "✅ Berhasil memperbarui teks Open Slot!", flags: [MessageFlags.Ephemeral] });
      }
    }

    if (interaction.commandName === "sendteks") {
      const { embeds, components } = getOrderEmbed();
      const msg = await interaction.channel.send({ embeds, components });
      
      const db = loadDB();
      db.orderMsg = {
        channelId: interaction.channelId,
        messageId: msg.id
      };
      saveDB(db);

      return interaction.reply({ content: "✅ Teks order terkirim dan akan otomatis terupdate setiap menit.", flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.commandName === "chat") {
      const pesan = interaction.options.getString("pesan");
      await interaction.reply({ content: "✅ Pesan terkirim", flags: [MessageFlags.Ephemeral] });
      return interaction.channel.send({ content: pesan });
    }

    if (interaction.commandName === "cek") {
      const isAdmin = Array.isArray(config.adminRoleId) 
        ? config.adminRoleId.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.roles.cache.has(config.adminRoleId);

      const isTicketAdmin = Array.isArray(config.ticketAdminRoleId) 
        ? config.ticketAdminRoleId.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.roles.cache.has(config.ticketAdminRoleId);

      if (!isAdmin && !isTicketAdmin)
        return interaction.reply({ content: "❌ Admin atau Ticket Admin only", flags: [MessageFlags.Ephemeral] });

      if (!interaction.channel.name.startsWith("ticket-"))
        return interaction.reply({ content: "❌ Bukan channel ticket", flags: [MessageFlags.Ephemeral] });

      await interaction.deferReply();

      const db = loadDB();
      const ticket = db.tickets.find(t => interaction.channel.name.split("-").includes(t.ticketId.toString()));

      if (!ticket) {
        return interaction.editReply({ content: "⚠️ Ticket tidak ditemukan di database" });
      }

      if (ticket.status === "PAID") {
        return interaction.editReply({ content: "⚠️ Ticket ini sudah dikonfirmasi sebelumnya" });
      }

      ticket.status = "PAID";
      saveDB(db);

      const member = await interaction.guild.members.fetch(ticket.userId);
      const product = products[ticket.product];
      const targetVipChannel = interaction.options.getChannel("channel");

      const paidEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("🛒 Berhasil Masuk Server VIP")
        .setDescription(
          `ANDA SUDAH MASUK DALAM LIST SERVER VIP,\nSilahkan cek <#${targetVipChannel.id}>\n\n` +
          `**Server VIP**\n🏰 <#${targetVipChannel.id}>\n` +
          `**Ticket ID**\n#${ticket.ticketId}`
        )
        .setFooter({ text: config.footer })
        .setTimestamp();

      try {
        await member.roles.add(product.roleId);
        
        if (targetVipChannel) {
          await targetVipChannel.send({
            content: `🎊 Selamat datang <@${ticket.userId}> di Server VIP!`
          });
        }
      } catch (err) {
        console.error("❌ Gagal memberikan role:", err.message);
        return interaction.editReply({ 
          content: "⚠️ **Gagal memberikan role!**\nPastikan posisi Role Bot berada di atas role yang ingin diberikan di pengaturan server (Role Hierarchy).", 
        });
      }

      await member.send({ embeds: [paidEmbed] }).catch(() => console.error("❌ Gagal kirim DM ke user"));

      const doneCount = db.tickets.filter(t => t.status === "PAID" || t.status === "DONE").length;
      const arrowEmoji = "<a:arrowright:1461162722313109778>";
      const verifyEmoji = "<a:greenverifiedgif:1461165245283176459>";

      const logEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("✅ PEMBAYARAN BERHASIL")
        .setDescription(
          `${arrowEmoji} **Traksaksi ID:** \`${ticket.invoiceId}\`\n` +
          `${arrowEmoji} **Orderan :** #${doneCount}\n` +
          `${arrowEmoji} **Pembeli:** <@${ticket.userId}>\n` +
          `${arrowEmoji} **Produk:** ${product.name}\n` +
          `${arrowEmoji} **Pembayaran:** ${interaction.options.getString("payment")}\n` +
          `${arrowEmoji} **Status:** Success ${verifyEmoji}\n` +
          `${arrowEmoji} **Total:** ${product.price}`
        )
        .setImage("https://media.discordapp.net/attachments/1328994791552159831/1460391307074732042/terpercaya.png")
        .setFooter({ text: config.footer })
        .setTimestamp();

      interaction.guild.channels.cache.get(config.logChannelId)
        ?.send({ embeds: [logEmbed] });

      await interaction.editReply({ 
        content: `✅ PEMBAYARAN BERHASIL\n━━━━━━━━━━━━━━━━━━━━━━\n👤 User: <@${ticket.userId}>\n📦 Produk: ${product.name}\n⏰ Durasi: ${product.duration} JAM\n🏰 Server: <#${targetVipChannel.id}>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 **SILAHKAN CEK DM BOT**`, 
      });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }

  if (interaction.isButton()) {
    const { MessageFlags } = require("discord.js");
    const db = loadDB();

    if (interaction.customId === "close_ticket") {
      const ticketIndex = db.tickets.findIndex(t => interaction.channel.name.includes(t.ticketId));
      const isTicketAdmin = Array.isArray(config.ticketAdminRoleId) 
        ? config.ticketAdminRoleId.some(roleId => interaction.member.roles.cache.has(roleId))
        : interaction.member.roles.cache.has(config.ticketAdminRoleId);

      if (!isTicketAdmin && interaction.user.id !== db.tickets[ticketIndex]?.userId) {
        return interaction.reply({ content: "❌ Hanya admin ticket atau pembuat ticket yang bisa menutup ini.", flags: [MessageFlags.Ephemeral] });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirm_close").setLabel("Ya, Tutup").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("cancel_close").setLabel("Batal").setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "⚠️ Apakah Anda yakin ingin menutup ticket ini?",
        components: [confirmRow],
        flags: [MessageFlags.Ephemeral]
      });
    }

    if (interaction.customId === "confirm_close") {
      const ticketIndex = db.tickets.findIndex(t => interaction.channel.name.includes(t.ticketId));
      if (ticketIndex !== -1) {
        db.tickets[ticketIndex].status = "DONE";
        saveDB(db);
      }

      await interaction.reply("🔒 Ticket akan ditutup dalam 5 detik...");
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    if (interaction.customId === "cancel_close") {
      return interaction.reply({ content: "✅ Penutupan ticket dibatalkan.", flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.customId.startsWith("vip_")) {
      const db = loadDB();
      if (db.tickets.some(t => t.userId === interaction.user.id && t.status !== "DONE" && t.status !== "PAID")) {
        const activeTicket = db.tickets.find(t => t.userId === interaction.user.id && t.status !== "DONE" && t.status !== "PAID");
        const channelExists = interaction.guild.channels.cache.find(c => c.name.includes(activeTicket.ticketId));
        if (!channelExists) {
          activeTicket.status = "DONE";
          saveDB(db);
        } else {
          return interaction.reply({ content: "❌ Kamu masih punya order aktif", flags: [MessageFlags.Ephemeral] });
        }
      }

      const product = products[interaction.customId];
      if (!product) return;

      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const ticketId = genTicketId();
      const invoiceId = genInvoiceId();

      db.tickets.push({
        ticketId,
        invoiceId,
        userId: interaction.user.id,
        product: interaction.customId,
        status: "UNPAID",
        hasProof: false,
        createdAt: Date.now()
      });
      saveDB(db);

      const adminMentions = Array.isArray(config.ticketAdminRoleId) 
        ? config.ticketAdminRoleId.map(id => `<@&${id}>`).join(" ")
        : `<@&${config.ticketAdminRoleId}>`;

      const adminPermissions = Array.isArray(config.ticketAdminRoleId)
        ? config.ticketAdminRoleId.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }))
        : [{ id: config.ticketAdminRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }];

      let ticketChannelOptions = {
        name: `ticket-${ticketId}-${product.duration}jam`,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          ...adminPermissions
        ]
      };

      if (config.ticketCategoryId) {
        const category = interaction.guild.channels.cache.get(config.ticketCategoryId);
        if (category && category.type === 4) {
          ticketChannelOptions.parent = config.ticketCategoryId;
        }
      }

      const channel = await interaction.guild.channels.create(ticketChannelOptions);

      const invoiceEmbed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("🧾 INVOICE PEMBAYARAN")
        .setDescription(
          `Invoice ID : \`${invoiceId}\`\n` +
          `User : <@${interaction.user.id}>\n` +
          `Produk : ${product.name}\n` +
          `Harga : ${product.price}\n` +
          `Status : ❌ UNPAID`
        )
        .addFields(
          { name: "💳 Metode Pembayaran", value: `• DANA: ${config.payment.dana}\n• GOPAY: ${config.payment.gopay}\n• QRIS: Scan gambar di bawah`, inline: false },
          { name: "📜 Ketentuan", value: config.payment.terms.join("\n"), inline: false }
        )
        .setFooter({ text: config.footer })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("❌ Close Ticket").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `> 👤 <@${interaction.user.id}> 👑 ${adminMentions}`,
        embeds: [invoiceEmbed.setImage("attachment://qris.png")],
        files: [{ attachment: "./qris.png", name: "qris.png" }],
        components: [row]
      });

      await interaction.editReply({ content: `✅ Ticket Order Berhasil Dibuat! <#${channel.id}>` });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.channel.name?.startsWith("ticket-")) return;
  if (message.attachments.size === 0) return;

  const attachment = message.attachments.first();
  if (!attachment.contentType?.startsWith("image/")) return;

  try {
    const text = await tesseract.recognize(attachment.url, tesseractConfig);
    const lowText = text.toLowerCase();
    const keywords = ["dana", "gopay", "berhasil", "sukses", "transfer", "pembayaran", "rp", "total"];
    const found = keywords.some(k => lowText.includes(k));

    if (found) {
      const db = loadDB();
      const ticket = db.tickets.find(t => message.channel.name.includes(t.ticketId.toString()));
      if (ticket) {
        ticket.hasProof = true;
        saveDB(db);
      }

      // Ekstraksi Nominal (mencari pola Rp 50.000 atau angka setelah Rp)
      let nominal = "Tidak terdeteksi";
      const rpMatch = text.match(/Rp\s?([\d.,]+)/i);
      if (rpMatch) nominal = `Rp ${rpMatch[1]}`;

      // Ekstraksi Nama Penerima (biasanya setelah kata 'Ke' atau 'Penerima')
      let penerima = "Tidak terdeteksi";
      const targetKeywords = ["ke", "penerima", "transfer ke"];
      for (const key of targetKeywords) {
        const regex = new RegExp(`${key}\\s?:?\\s*([A-Z ]{3,30})`, "i");
        const match = text.match(regex);
        if (match && match[1]) {
          penerima = match[1].trim();
          break;
        }
      }

      try {
        const admin = await client.users.fetch(config.mainAdminId);
        const embed = new EmbedBuilder()
          .setColor(0x00ff88)
          .setTitle("📸 BUKTI PEMBAYARAN TERDETEKSI")
          .setDescription(`User <@${message.author.id}> mengirim bukti pembayaran di <#${message.channel.id}>`)
          .addFields(
            { name: "👤 Nama Penerima", value: `\`${penerima}\``, inline: true },
            { name: "💰 Nominal", value: `\`${nominal}\``, inline: true },
            { name: "📝 Teks Terdeteksi", value: text.substring(0, 500) + (text.length > 500 ? "..." : "") }
          )
          .setFooter({ text: config.footer })
          .setTimestamp();

        await admin.send({ embeds: [embed], files: [attachment.url] }).catch((e) => console.error("Gagal kirim DM Admin:", e.message));
        await message.reply({
          content: `✅ **Bukti Pembayaran Terdeteksi!**\n━━━━━━━━━━━━━━━━━━━━━━\n👤 **Penerima:** \`${penerima}\`\n💰 **Nominal:** \`${nominal}\`\n━━━━━━━━━━━━━━━━━━━━━━\nAdmin telah dinotifikasi untuk pengecekan.`
        });
      } catch (adminErr) {
        console.error("Gagal memproses notifikasi admin:", adminErr.message);
        await message.reply("✅ Bukti pembayaran terdeteksi! Admin akan segera mengecek ticket ini.");
      }
    }
  } catch (err) {
    console.error("OCR Error:", err);
  }
});

client.login(config.token);
