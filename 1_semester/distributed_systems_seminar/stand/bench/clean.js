#!/usr/bin/env node
// Чистка message log между прогонами: TRUNCATE logrecord на всех SS + удалить архивы.
// Секунды, вместо минуты на restore volume'ов. Сертификаты и конфигурация не трогаются.
//   node bench/clean.js
'use strict';
const L = require('./lib');

function clean(containers = ['ss0', 'ss1', 'ss2', 'ss3'].filter(L.running)) {   // ss3 во время сетки остановлен
  for (const c of containers) {
    const before = L.messagelogBytes(c);
    // CASCADE: message_attachment ссылается на logrecord по FK — чистим вместе
    L.psql(c, 'messagelog', `TRUNCATE ${L.pgTable(c, 'messagelog', 'logrecord')} CASCADE`);
    // тела сообщений X-Road пишет в large objects; TRUNCATE их не трогает → до 30.09 копились (12 ГБ на ss1/ss2).
    // В базе messagelog других large objects нет — удаляем все, пачками (lo_unlink берёт блокировку на объект)
    while (Number(L.psql(c, 'messagelog', 'SELECT count(lo_unlink(oid)) FROM (SELECT oid FROM pg_largeobject_metadata LIMIT 2000) t')) > 0);
    L.dexecOk(c, 'sh', '-c', 'rm -f /var/lib/xroad/*.zip /var/lib/xroad/*.asice 2>/dev/null; true');
    L.psql(c, 'messagelog', 'VACUUM');
    L.log(`${c}: messagelog ${(before / 1e6).toFixed(1)} MB → ${(L.messagelogBytes(c) / 1e6).toFixed(1)} MB`);
  }
}

module.exports = { clean };
if (require.main === module) clean();
