const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");

const commands = [
  new SlashCommandBuilder().setName("sendteks").setDescription("Kirim teks order VIP"),
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Kirim pesan sebagai bot")
    .addStringOption(option =>
      option.setName("pesan")
        .setDescription("Pesan yang ingin dikirim")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("cek")
    .setDescription("Konfirmasi pembayaran (Admin Only)")
    .addStringOption(option =>
      option.setName("payment")
        .setDescription("Metode pembayaran")
        .setRequired(true)
        .addChoices(
          { name: "DANA", value: "DANA" },
          { name: "GOPAY", value: "GOPAY" },
          { name: "QRIS", value: "QRIS" }
        ))
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Channel untuk teks SERVER VIP")
        .setRequired(true)),
  new SlashCommandBuilder().setName("ping").setDescription("Ping bot"),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Menu bantuan bot")
    .addSubcommand(sub => 
      sub.setName("order").setDescription("Panduan tata cara pembelian VIP")
    )
    .addSubcommand(sub => 
      sub.setName("fitur").setDescription("Bantuan daftar fitur dan command bot")
    ),
  new SlashCommandBuilder()
    .setName("setting")
    .setDescription("Pengaturan produk VIP (Admin Only)")
    .addSubcommand(sub =>
      sub.setName("list").setDescription("Lihat daftar produk")
    )
    .addSubcommand(sub =>
      sub.setName("edit")
        .setDescription("Edit produk yang sudah ada")
        .addStringOption(opt => opt.setName("id").setDescription("ID Produk (contoh: vip_6)").setRequired(true))
        .addStringOption(opt => opt.setName("nama").setDescription("Nama baru produk"))
        .addStringOption(opt => opt.setName("harga").setDescription("Harga baru produk"))
        .addIntegerOption(opt => opt.setName("durasi").setDescription("Durasi baru (jam)"))
        .addStringOption(opt => opt.setName("status").setDescription("Status produk").addChoices({name:"Open", value:"open"}, {name:"Close", value:"close"}))
    )
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Tambah produk baru")
        .addStringOption(opt => opt.setName("id").setDescription("ID Produk unik (contoh: vip_48)").setRequired(true))
        .addStringOption(opt => opt.setName("nama").setDescription("Nama produk").setRequired(true))
        .addStringOption(opt => opt.setName("harga").setDescription("Harga produk (contoh: Rp 50.000)").setRequired(true))
        .addIntegerOption(opt => opt.setName("durasi").setDescription("Durasi (jam)").setRequired(true))
        .addStringOption(opt => opt.setName("role_id").setDescription("Role ID untuk produk ini").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("delete")
        .setDescription("Hapus produk")
        .addStringOption(opt => opt.setName("id").setDescription("ID Produk yang akan dihapus").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("edit_openslot")
        .setDescription("Ubah teks pengumuman Open Slot")
        .addStringOption(opt => opt.setName("teks").setDescription("Teks pengumuman baru (gunakan {adminMentions} dan {ownerMention})").setRequired(true))
    ),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  await rest.put(
    Routes.applicationCommands(config.clientId),
    { body: commands }
  );
  console.log("Slash command terdaftar");
})();