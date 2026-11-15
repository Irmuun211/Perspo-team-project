// =============================================================================
// i18n.js — TRANSLATION DICTIONARY (ХЭЛНИЙ САН)
// Та эндээс Монгол болон Англи бичвэрийг хялбархан засах боломжтой!
// Edit any Mongolian / English text here. {placeholders} are filled in by the app.
// =============================================================================
const TRANSLATIONS = {
  // ===========================================================================
  // МОНГОЛ
  // ===========================================================================
  mn: {
    appTitle: "Монголын Тариалангийн Туслах",
    appSubtitle: "NASA-ийн хиймэл дагуул, уур амьсгалын өгөгдөлд суурилсан тариалангийн сэлгээний шийдвэр дэмжих систем",

    mapHeading: "Газрын зураг дээр дурын цэг дээр дарна уу",
    mapHint: "Монгол орны аль ч цэг дээр дарахад NASA POWER-ийн 20 жилийн өгөгдлийг татаж, таримал бүрийн тохирцыг үнэлнэ. Эсвэл «Миний байршил» товчоор өөрийн байршлыг, эсвэл доорх онцлох бүсүүдээс сонгоно уу.",
    layerMap: "Газрын зураг",
    layerSat: "Хиймэл дагуул",
    btnOverview: "Бүх бүс",
    customPointName: "Сонгосон цэг",
    outsideMongolia: "Энэ цэг Монгол улсын хилээс гадна байна. Хил дотор дарна уу.",
    popupCoordLabel: "Координат:",
    popupElevLabel: "Өндөршил:",
    popupNearestLabel: "Харьцуулах онцлох бүс:",
    loadingShort: "Ачаалж байна…",

    statusLive: "NASA POWER шууд өгөгдөл (2006–2025)",
    statusLoading: "NASA POWER-оос 20 жилийн өгөгдөл татаж байна…",
    statusFallback: "Ойролцоо суурь утга (шууд өгөгдөл биш)",
    fallbackNote: "NASA POWER-т холбогдож чадсангүй. Доорх тоо нь {region}-ийн ойролцоо суурь утга бөгөөд хэмжилт биш.",
    resolutionNote: "NASA POWER-ийн утга нь ~50 км торын дундаж тул таны талбайн бичил уур амьсгалыг бүрэн илэрхийлэхгүй.",

    alert: {
      season: { title: "NASA анхааруулга: Ургалтын хугацаа богино, хяруу эрт/орой унах эрсдэлтэй",
                desc: "Сүүлийн 10 жилд энд дунджаар {ff} хоног хяруугүй байсан ({start} – {end}). Богино хугацаанд боловсордог арвай, овъёс, вандуй болон өвөлд тэсвэртэй шар царгас илүү найдвартай." },
      droughtNoSoil: { title: "NASA анхааруулга: Хуурай улирал",
                desc: "5–9-р сард дунджаар {rain} мм хур тунадас ордог. Хөрсийг нүцгэн орхивол салхинд хийсэх эрсдэлтэй — ус бага шаарддаг, хөрс бүрхэх сэлгээг сонгоно уу." },
      heat:   { title: "NASA анхааруулга: Зуны дунд үеийн халуун",
                desc: "Цэцэглэлтийн үед (6/15–8/15) жилд дунджаар {heat} өдөр 30°C-ээс давж байна{trend}. Ийм халуун улаан буудай, тосны ургамлын үр тогтолтыг бууруулдаг." },
      drought:{ title: "NASA анхааруулга: Хуурайшилт ба хаврын хөрсний чийгийн дутагдал",
                desc: "5–9-р сард дунджаар {rain} мм хур тунадас ордог, 5-р сарын өнгөн хөрсний чийгшил {soil}/100. Хөрсийг нүцгэн орхивол салхинд хийсэх эрсдэлтэй — ус бага шаарддаг, хөрс бүрхэх сэлгээг сонгоно уу." },
      ok:     { title: "NASA: Энэ газрын уур амьсгал тариалан эрхлэхэд харьцангуй тааламжтай",
                desc: "{ff} хяруугүй хоног, {rain} мм хур тунадас, жилд {heat} халуун өдөр. Гол эрсдэл нь дан тариалалтаас үүдэх хөрсний доройтол — сэлгээгээр хөрсөө хамгаална уу." },
      trendMore: " — 2006–2015 оныхоос {d}-ээр их"
    },

    metricsTitle: "NASA POWER уур амьсгалын үзүүлэлт (сүүлийн 10 жилийн дундаж)",
    m_ff_label: "Хяруугүй хоног",
    m_ff_note: "Ихэвчлэн {start} – {end}",
    m_heat_label: "Халуун өдөр (≥30°C)",
    m_heat_note: "6/15–8/15, цэцэглэлтийн үе",
    m_rain_label: "Ургалтын үеийн хур тунадас",
    m_rain_note: "5–9-р сарын нийлбэр",
    m_soil_label: "Хаврын өнгөн хөрсний чийгшил",
    m_soil_note: "5-р сар • 0 хуурай – 100 ус тогтсон",
    m_soil_na: "Энэ цэгт хөрсний чийгийн өгөгдөл байхгүй",
    unitDays: "хоног",
    unitMm: "мм",
    trendVs: "2006–2015 онтой харьцуулахад",
    trendNA: "Чиг хандлага: шууд өгөгдөл хэрэгтэй",

    chartTitle: "Жил бүрийн өөрчлөлт (NASA POWER)",
    chartNoData: "NASA-ийн шууд өгөгдөл ачаалагдвал жил бүрийн график харагдана.",
    chartAvg: "дундаж",

    cropsHeading: "Таримал бүрийн тохирц энэ газарт",
    cropsSub: "Оноо нь NASA-ийн температур, хяруу, хур тунадас, хөрсний чийгийг таримал бүрийн шаардлагатай харьцуулж гаргасан. Орон нутгийн агрономичоор баталгаажуулна уу.",
    levelGood: "Тохиромжтой",
    levelRisky: "Эрсдэлтэй",
    levelPoor: "Тохиромжгүй",
    bestConditions: "Сайн ургах нөхцөл:",
    pastureNote: "Энэ газарт нэг наст таримал тогтвортой ургах нөхцөл муу байна. Бэлчээр эсвэл хадлангийн талбай болгон ашиглах нь илүү зохимжтой байж магадгүй.",
    lakeToast: "🌊 Энэ бол {lake}. Тариалан эрхлэх боломжгүй — эрэг орчмын газар дээр дарна уу.",
    checkingWater: "🔎 Газрын зургаас шалгаж байна (нуур, барилга, байршил)…",
    unnamedWater: "нуур / усан гадаргуу",
    builtToast: "🏘️ Энэ цэг суурьшлын бүс байна ({place}). Барилга, хотын газар тариалангийн талбай биш — хотоос гадна газар дээр дарна уу.",
    unnamedBuilt: "барилга / суурин газар",
    locateMe: "Миний байршил",
    seeResults: "Үр дүнг харах",
    showAllCrops: "Бүх {n} таримлыг харах",
    showFewerCrops: "Цөөнийг харуулах",
    myLocation: "Миний байршил",
    geoLocating: "📡 Таны байршлыг тодорхойлж байна…",
    geoDenied: "Байршил тогтоох зөвшөөрөл олгогдоогүй байна. Хөтчийн тохиргооноос зөвшөөрнө үү.",
    geoFailed: "Байршлыг тодорхойлж чадсангүй. Дахин оролдох эсвэл газрын зураг дээр дарна уу.",
    geoUnsupported: "Таны төхөөрөмж байршил тогтоохыг дэмжихгүй байна. Газрын зураг дээр дарна уу.",
    geoOutside: "Таны байршил Монгол улсаас гадна байна. Газрын зураг дээр Монгол доторх цэг сонгоно уу.",
    geoBuiltNote: "📍 Та суурин газарт байна. NASA-ийн өгөгдөл ~50 км хамардаг тул эргэн тойрны тариалангийн талбайн нөхцөлийг харуулж байна.",
    popupAreaLabel: "Байршил:",

    controlsHeading: "Таны тэргүүлэх зорилго юу вэ?",
    priorities: { balanced: "Тэнцвэртэй", soil: "Хөрс сэргээх", feed: "Малын тэжээл", income: "Орлого", water: "Ус хэмнэх" },
    irrigationLabel: "Усалгаатай талбай",

    strategyHeading: "Тариалангийн сэлгээний стратеги — энэ газарт тохирсон дарааллаар",
    strategySub: "Одоогийн дадлыг үргэлж харуулж, бусад 7 стратегиас хамгийн тохирох 3-ыг санал болгоно. Карт дээр дарж дэлгэрэнгүйг үзнэ үү.",
    recommendedBadge: "Хамгийн тохиромжтой",
    currentBadge: "Одоогийн дадал",
    clickToInspect: "Дэлгэрэнгүй",
    fitLabel: "Тохирц",
    benefitLabel: "Давуу тал",
    catchLabel: "Анхаарах зүйл ба эрсдэл",
    evidenceLabel: "Нотолгоо",
    gapsLabel: "Мэдээллийн хоосон зай — орон нутагт шалгах",
    hereLabel: "Энэ газарт (NASA өгөгдлөөр):",
    attrLabels: { soil: "Хөрс", feed: "Тэжээл", income: "Орлого", water: "Ус хэмнэлт" },
    attrLevels: ["Бага", "Дунд", "Сайн", "Маш сайн"],

    tableHeading: "Бүх стратегийн хураангуй хүснэгт",
    thStrategy: "Стратеги",
    thCrops: "Сэлгээ",
    thFit: "Тохирц",
    thSoil: "Хөрс",
    thWater: "Усны хэрэглээ",
    thFeed: "Малын тэжээл",

    disclaimer: "Анхааруулга: Энэ систем нь NASA POWER-ийн уур амьсгалын өгөгдөлд суурилсан шийдвэр дэмжих хэрэгсэл бөгөөд тариаланчийн туршлага, мэргэжилтний зөвлөгөөг орлохгүй. Тариалангийн сэлгээгээ өөрчлөхөөс өмнө орон нутгийн агрономичтой заавал зөвлөлдөнө үү.",
    footerSources: "Өгөгдөл: NASA POWER өдөр тутмын цэгийн API (MERRA-2 загварт суурилсан, ~50 км тор) • Хил: Natural Earth • Нуур, барилга, газрын нэр: © OpenStreetMap • Газрын зураг: Esri",
    footerMethod: "Аргачлал: 2016–2025 оны дунджийг таримал бүрийн температур, хяруу, усны шаардлагатай харьцуулсан дүрэмд суурилсан оноо.",

    reasons: {
      r_ff: "Хяруугүй хоног ~{v} (шаардлага ~{need})",
      r_gdd: "Зуны дулаан хангалтгүй: {v} градус-хоног (шаардлага ~{need})",
      r_heat: "Цэцэглэлтийн үед {thr}°C-ээс дээш {v} өдөр",
      r_nights: "Дулаан шөнө (≥18°C) {v} удаа — булцуу үүсэлтийг сааруулна",
      r_rain: "Хур тунадас {v} мм (шаардлага ~{need} мм)",
      r_irrig: "Усалгаа шаардлагатай: хур тунадас {v} мм",
      r_soil: "Хаврын хөрс хуурай (чийгшил {v}/100)",
      r_late: "Тарьсны дараах хүйтрэлт (≤−2°C) жилд {v} өдөр",
      r_early: "Хураалтын өмнөх намрын хяруу жилд {v} өдөр",
      r_fine: "Уур амьсгал сайн тохирч байна"
    },

    months: ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"],
    dateFmt: "{month}ын {day}",

    regions: {
      selenge:  { shortName: "Сэлэнгэ",  fullName: "Сэлэнгэ аймаг",           zoneTag: "Тариалангийн гол бүс" },
      darkhan:  { shortName: "Дархан-Уул", fullName: "Дархан-Уул аймаг",      zoneTag: "Судалгааны төв" },
      khovsgol: { shortName: "Хөвсгөл",  fullName: "Хөвсгөл (Тариалан сум)", zoneTag: "Хойд сэрүүн бүс" },
      bulgan:   { shortName: "Булган",   fullName: "Булган аймаг",            zoneTag: "Ойт хээрийн тариалангийн бүс" },
      tov:      { shortName: "Төв",      fullName: "Төв аймаг", zoneTag: "Тал хээрийн бүс" },
      khentii:  { shortName: "Хэнтий",   fullName: "Хэнтий аймаг",            zoneTag: "Зүүн тал хээр" },
      uvs:      { shortName: "Увс",      fullName: "Увс аймаг (Улаангом)",     zoneTag: "Баруун хуурай бүс" }
    },

    crops: {
      wheat:        { name: "Улаан буудай", role: "Үр тариа", best: "Сэрүүн зун; цэцэглэлтийн үед 12–22°C, 30°C-ээс дээш халуунд тохиромжгүй" },
      barley:       { name: "Арвай", role: "Үр тариа / соёолж", best: "Хамгийн богино хугацаанд (70–90 хоног) боловсорно; ган, сэрүүнд тэсвэртэй" },
      oats:         { name: "Овъёс", role: "Үр тариа / тэжээл", best: "Сэрүүн, чийглэг зун; халуунд мэдрэг" },
      potato:       { name: "Төмс", role: "Хүнс", best: "Булцуу 15–20°C-д сайн үүснэ; хяруу, дулаан шөнөд мэдрэг" },
      rapeseed:     { name: "Тосны ургамал", role: "Тос", best: "Сэрүүн; цэцэглэлтэд 27–30°C-ээс дээш халуунд тохиромжгүй, улаан буудайгаас их ус хэрэглэнэ" },
      pea:          { name: "Вандуй", role: "Уураг / азот", best: "Хөрсөнд азот хуримтлуулна; сэрүүн, богино улиралд тохиромжтой" },
      buckwheat:    { name: "Гурвалжин будаа", role: "Үр тариа ", best: "Үржил шим багатай хөрсөнд ургана; хяруунд маш мэдрэг" },
      alfalfa:      { name: "Шар царгас", role: "Олон наст тэжээл", best: "Өвөл, ганд тэсвэртэй, азот хуримтлуулна" },
      seabuckthorn: { name: "Чацаргана", role: "Олон наст жимс / салхин хаалт", best: "−40…+40°C-д тэсвэртэй, гүн үндэстэй; талбайн зах, ойн зурваст" },
      vegetables:   { name: "Хүнсний ногоо", role: "Байцаа, лууван, манжин", best: "Сэрүүн зун, ихэвчлэн усалгаатай; хяруунд мэдрэг" }
    },

    strategies: {
      baseline: {
        name: "Одоогийн дадал", crops: "Дан улаан буудай",
        benefit: "Одоо байгаа техник, зах зээл, тариаланчдын туршлагад бүрэн нийцнэ.",
        catch: "Жил бүр нэг таримал тарих нь хөрсний чийг, ялзмаг, азотыг шавхаж, хортон шавж, өвчнийг хуримтлуулна. Хураалтын дараа талбай нүцгэн үлдэж салхинд хийснэ.",
        evidence: "Монголын тариалангийн талбайн 75 гаруй хувь нь үр тариа, ихэнх нь улаан буудай. 2025 онд 5–7-р сарын халуун, гангаас болж ургац буурсан (FAO GIEWS).",
        gaps: "Таны талбайн ялзмаг, азотын түвшин, хортон шавжийн түүх.",
        tableSoil: "⚠️ Хөрс доройтно", tableWater: "Дунд", tableFeed: "❌ Бага"
      },
      soil_protector: {
        name: "Хөрс хамгаалагч", crops: "Улаан буудай ➔ Тосны ургамал",
        benefit: "Тосны ургамлын гол үндэс нягтарсан хөрсийг сийрэгжүүлж, үр тарианы өвчний мөчлөгийг тасална. Тосны ургамал улаан буудайгаас ~3 дахин үнэтэй, экспортын зах зээлтэй.",
        catch: "Тосны ургамал улаан буудайгаас их ус хэрэглэдэг, сүрэл нь бага тул өвлийн салхинаас хамгаалалт сул. Цэцэглэлтийн үед 27–30°C-ээс дээш халуун хортой. Жижиг үр асгарахаас сэргийлж комбайн тохируулна.",
        evidence: "Монголд хийсэн судалгаагаар тосны ургамлын талбай улаан буудайгаас их ус хэрэглэж, уринш жилд бага ус хуримтлуулдаг (Miyasaka нар, 2021). Сэлэнгэд тосны ургамлын үйлдвэр ажилладаг.",
        gaps: "Склеротиниоз өвчний эрсдэл, тосны үйлдвэр хүртэлх зай, үрийн чанар.",
        tableSoil: "✅ Үндэс хөрс сийрэгжүүлнэ", tableWater: "Их", tableFeed: "➖ Шахдас"
      },
      livestock_saver: {
        name: "Малын тэжээл ба хөрс сэргээгч", crops: "Улаан буудай ➔ Шар царгас (3–4 жил)",
        benefit: "Агаарын азотыг хөрсөнд хуримтлуулж, олон жил хөрсийг бүрхэн салхины элэгдлээс хамгаална. Зудын үед уураг ихтэй хадлан болно.",
        catch: "Эхний жилд удаан ургах тул хогийн ургамлын хяналт шаардана. Энгийн (ягаан цэцэгтэй) царгас өвөлдөө үхэх магадлал өндөр — шар цэцэгтэй (falcata) сорт сонгоно.",
        evidence: "Шар цэцэгтэй царгас энгийн царгаснаас ган, хүйтэнд илүү тэсвэртэй (USDA NRCS). ADB-ийн туршилтаар согоовор, царгас, ерхөгийн холимог, ялангуяа усалгаатай үед, хамгийн сайн ургацтай.",
        gaps: "Шар царгасны үрийн нөөц, хадлан хадах техник, малчдын тэжээлийн эрэлт.",
        tableSoil: "⭐ Азот + бүрхэвч", tableWater: "Дунд", tableFeed: "⭐ Маш их"
      },
      legume_boost: {
        name: "Азот нэмэгч", crops: "Улаан буудай ➔ Вандуй ➔ Арвай",
        benefit: "Вандуй хөрсөнд азот үлдээж, дараагийн тарианы бордооны зардлыг бууруулна. Арвай хурдан боловсорч, импортын соёолжны арвайг орлох боломжтой.",
        catch: "Вандуй цэцэглэлтийн үед ганд мэдрэг, хураалтын үед хэвтэх тул тохирох техник хэрэгтэй. Вандуйн зах зээл одоогоор жижиг.",
        evidence: "Монголын төв бүсийн туршилтаар үет ургамалтай 3 жилийн сэлгээнд хөрсний хөдөлгөөнт азот 45–76%-иар нэмэгдсэн (Myagmarsuren & Begz, 2024).",
        gaps: "Вандуйн үр, худалдан авагч, ризобиум бактерийн бэлдмэл.",
        tableSoil: "⭐ Азот нэмнэ", tableWater: "Бага–дунд", tableFeed: "➖ Дунд"
      },
      short_season: {
        name: "Богино улирлын тэжээл", crops: "Арвай ➔ Овъёс + вандуйн хадлан",
        benefit: "Богино хугацаанд боловсордог тул хяруу эрт унадаг хойд бүсэд тохиромжтой. Овъёс-вандуйн холимог уураг ихтэй хадлан өгч, вандуй хөрсөнд азот нэмнэ.",
        catch: "Овъёс халуун, гандуу зунд муу ургана. Хадлангийн үнэ жилээс жилд хэлбэлзэлтэй.",
        evidence: "ADB-ийн дэмжсэн туршилтаар вандуй, овъёс, хөх тариа болон овъёс-вандуй, арвай-вандуйн холимог өндөр ургац өгсөн.",
        gaps: "Хадлан хадах, боох техник; орон нутгийн малчдын эрэлт.",
        tableSoil: "✅ Бүрхэвч + азот", tableWater: "Бага–дунд", tableFeed: "⭐ Их"
      },
      potato_cash: {
        name: "Орлогын сэлгээ", crops: "Төмс ➔ Арвай",
        benefit: "Төмс дотоодын эрэлт өндөртэй, ашигтай таримал. Дараа нь арвай тарьснаар төмсний өвчин, хортон шавжийн мөчлөг тасарна.",
        catch: "Төмс их ус, хөдөлмөр шаарддаг, ихэвчлэн усалгаатай; хяруу болон дулаан шөнөд мэдрэг. Хураалтын дараа хөрс сийрэг, нүцгэн үлдэж элэгдэнэ.",
        evidence: "Төв аймаг улсын төмсний 40 гаруй хувийг үйлдвэрлэдэг. 2024 онд төмс, арвай, овъёсны ургац дунджаас өндөр байсан (FAO GIEWS).",
        gaps: "Усалгааны эх үүсвэр, агуулах, үрийн төмсний чанар.",
        tableSoil: "⚠️ Элэгдлийн эрсдэл", tableWater: "Их", tableFeed: "➖ Бага"
      },
      low_input: {
        name: "Бага зардалтай", crops: "Улаан буудай ➔ Гурвалжин будаа",
        benefit: "Гурвалжин будаа үржил шим багатай хөрсөнд ургаж, бордоо бага шаардана. Хурдан ургаж хогийн ургамлыг дарж, зөгийн балны эх үүсвэр болно.",
        catch: "Гурвалжин будаа хяруунд маш мэдрэг тул хяруугүй хугацаа богино газарт эрсдэлтэй. Монголд 2010 оноос тариалж эхэлсэн тул туршлага бага.",
        evidence: "Төв аймгийн Борнуурт сортын туршилт хийгдсэн; Гурвалжин будаа Монголын бараг бүх бүсэд ургах чадвартай (MJAS).",
        gaps: "Тохирох сорт, хальслах үйлдвэр, зах зээлийн үнэ.",
        tableSoil: "✅ Хогийн ургамал дарна", tableWater: "Бага", tableFeed: "❌ Бага"
      },
      shelterbelt: {
        name: "Салхин хаалт + жимс", crops: "Чацарганын зурвас + Арвай",
        benefit: "Талбайн захад чацарганы эгнээ тарьснаар салхины хурдыг сааруулж, цас тогтоож, азот хуримтлуулна. Жимс нь өндөр үнэтэй, эрэлт өндөртэй.",
        catch: "Олон наст тул 3–4 жилийн дараа ургац өгч, талбайн хэсгийг байнга эзэлнэ. Эхний жилүүдэд усалгаа хэрэгтэй.",
        evidence: "Монголд 40 гаруй жил, 7,000 гаруй га-д тариалж байна; −40…+40°C, гандуу нөхцөлд тэсвэртэй.",
        gaps: "Суулгацын эх үүсвэр, хашаа, хураалтын ажиллах хүч.",
        tableSoil: "⭐ Салхинаас хамгаална", tableWater: "Дунд", tableFeed: "➖ Бага"
      }
    }
  },

  // ===========================================================================
  // ENGLISH
  // ===========================================================================
  en: {
    appTitle: "Mongolian Crop Co-Pilot",
    appSubtitle: "Crop-rotation decision support for Mongolian farmers, powered by NASA Earth data",

    mapHeading: "Tap anywhere on the map",
    mapHint: "Click any spot in Mongolia to pull 20 years of NASA POWER data and score each crop for that place. Use “My location” for where you are, or pick a featured farming region below.",
    layerMap: "Map",
    layerSat: "Satellite",
    btnOverview: "All Mongolia",
    customPointName: "Selected point",
    outsideMongolia: "This point is outside Mongolia. Please tap inside the border.",
    popupCoordLabel: "Coordinates:",
    popupElevLabel: "Elevation:",
    popupNearestLabel: "Closest featured region:",
    loadingShort: "Loading…",

    statusLive: "Live NASA POWER data (2006–2025)",
    statusLoading: "Fetching 20 years of NASA POWER data…",
    statusFallback: "Approximate built-in values (not live)",
    fallbackNote: "Couldn't reach NASA POWER. The numbers below are approximate built-in values for {region}, not measurements.",
    resolutionNote: "NASA POWER values are ~50 km grid averages and won't capture your field's microclimate.",

    alert: {
      season: { title: "NASA alert: Short growing season & frost risk",
                desc: "Over the last 10 years this spot averaged {ff} frost-free days ({start} – {end}). Fast-maturing barley, oats, peas and winter-hardy yellow alfalfa are safer bets." },
      droughtNoSoil: { title: "NASA alert: Dry growing season",
                desc: "This spot gets about {rain} mm from May to September. Bare fields are prone to wind erosion — favour low-water, soil-covering rotations." },
      heat:   { title: "NASA alert: Mid-summer heat stress",
                desc: "During the flowering window (Jun 15 – Aug 15) this spot averages {heat} days above 30°C per year{trend}. Heat like this cuts grain and seed set in wheat and rapeseed." },
      drought:{ title: "NASA alert: Dry season & low spring soil moisture",
                desc: "This spot gets about {rain} mm from May to September and May topsoil wetness is {soil}/100. Bare fields are prone to wind erosion — favour low-water, soil-covering rotations." },
      ok:     { title: "NASA: Relatively favourable conditions for cropping",
                desc: "{ff} frost-free days, {rain} mm of season rain and {heat} hot days a year. The main risk is soil decline from monoculture — rotate to protect it." },
      trendMore: " — {d} more than in 2006–2015"
    },

    metricsTitle: "NASA POWER climate indicators (last-10-year average)",
    m_ff_label: "Frost-free days",
    m_ff_note: "Usually {start} – {end}",
    m_heat_label: "Hot days (≥30°C)",
    m_heat_note: "Jun 15–Aug 15, flowering window",
    m_rain_label: "Growing-season rainfall",
    m_rain_note: "May–Sep total",
    m_soil_label: "Spring topsoil wetness",
    m_soil_note: "May • 0 dry – 100 saturated",
    m_soil_na: "No soil-moisture data for this spot",
    unitDays: "days",
    unitMm: "mm",
    trendVs: "vs 2006–2015",
    trendNA: "Trend needs live data",

    chartTitle: "Year by year (NASA POWER)",
    chartNoData: "The year-by-year chart appears when live NASA data loads.",
    chartAvg: "avg",

    cropsHeading: "Crop suitability at this location",
    cropsSub: "Scores compare NASA temperature, frost, rainfall and soil-moisture data with each crop's needs. Confirm with a local agronomist.",
    levelGood: "Good fit",
    levelRisky: "Risky",
    levelPoor: "Poor fit",
    bestConditions: "Grows best when:",
    pastureNote: "Conditions here are poor for annual crops. This land may be better used as pasture or hay meadow.",
    lakeToast: "🌊 This is {lake} — not farmland. Tap on the land nearby instead.",
    checkingWater: "🔎 Checking the map (water, buildings, place name)…",
    unnamedWater: "a lake / water surface",
    builtToast: "🏘️ This spot is built-up land ({place}). Buildings and towns aren't farmland — tap on open land outside the town.",
    unnamedBuilt: "buildings / settlement",
    locateMe: "My location",
    seeResults: "See results",
    showAllCrops: "Show all {n} crops",
    showFewerCrops: "Show fewer",
    myLocation: "My location",
    geoLocating: "📡 Finding your location…",
    geoDenied: "Location permission was denied. Allow it in your browser settings.",
    geoFailed: "Couldn't get your location. Try again or tap the map.",
    geoUnsupported: "This device can't share its location. Tap the map instead.",
    geoOutside: "Your location is outside Mongolia. Tap a spot inside Mongolia on the map.",
    geoBuiltNote: "📍 You're in a built-up area. NASA data covers ~50 km, so this shows conditions for the farmland around you.",
    popupAreaLabel: "Area:",

    controlsHeading: "What matters most to you?",
    priorities: { balanced: "Balanced", soil: "Soil health", feed: "Livestock feed", income: "Income", water: "Save water" },
    irrigationLabel: "I can irrigate",

    strategyHeading: "Rotation strategies — ranked for this location",
    strategySub: "Your current practice is always shown, plus the 3 best of 7 alternatives. Click a card for details.",
    recommendedBadge: "Best match here",
    currentBadge: "Current practice",
    clickToInspect: "Details",
    fitLabel: "Fit here",
    benefitLabel: "Why it helps",
    catchLabel: "Trade-offs & risks",
    evidenceLabel: "Evidence",
    gapsLabel: "Information gaps — check locally",
    hereLabel: "At this location (NASA data):",
    attrLabels: { soil: "Soil", feed: "Feed", income: "Income", water: "Water saving" },
    attrLevels: ["Low", "Medium", "Good", "Excellent"],

    tableHeading: "All strategies at a glance",
    thStrategy: "Strategy",
    thCrops: "Rotation",
    thFit: "Fit",
    thSoil: "Soil",
    thWater: "Water use",
    thFeed: "Livestock feed",

    disclaimer: "Disclaimer: This is a decision-support tool based on NASA POWER climate data. It does not replace farmer experience or expert advice. Always consult a local Mongolian agronomist before changing your crop rotation.",
    footerSources: "Data: NASA POWER daily point API (MERRA-2 based, ~50 km grid) • Border: Natural Earth • Water, buildings & place names: © OpenStreetMap contributors • Basemaps: Esri",
    footerMethod: "Method: 2016–2025 averages compared with each crop's temperature, frost and water needs using transparent rule-based scores.",

    reasons: {
      r_ff: "Only ~{v} frost-free days (needs ~{need})",
      r_gdd: "Not enough summer warmth: {v} degree-days (needs ~{need})",
      r_heat: "{v} days ≥{thr}°C in the flowering window",
      r_nights: "{v} warm nights (≥18°C) — slows tuber formation",
      r_rain: "Season rain {v} mm (needs ~{need} mm)",
      r_irrig: "Needs irrigation: only {v} mm season rain",
      r_soil: "Dry spring topsoil (wetness {v}/100)",
      r_late: "{v} late frosts (≤−2°C) after sowing per year",
      r_early: "{v} early autumn frosts before harvest per year",
      r_fine: "Climate fits well"
    },

    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    dateFmt: "{month} {day}",

    regions: {
      selenge:  { shortName: "Selenge",  fullName: "Selenge Province",            zoneTag: "The Breadbasket" },
      darkhan:  { shortName: "Darkhan-Uul", fullName: "Darkhan-Uul Province",     zoneTag: "Research Hub" },
      khovsgol: { shortName: "Khövsgöl", fullName: "Khövsgöl (Tarialan sum)",     zoneTag: "The Harsh North" },
      bulgan:   { shortName: "Bulgan",   fullName: "Bulgan Province",             zoneTag: "Forest-Steppe Grain Belt" },
      tov:      { shortName: "Töv",      fullName: "Töv Province (near Bornuur)", zoneTag: "The Dry Steppe" },
      khentii:  { shortName: "Khentii",  fullName: "Khentii Province",            zoneTag: "The Eastern Steppe" },
      uvs:      { shortName: "Uvs",      fullName: "Uvs Province (Ulaangom)",     zoneTag: "The Dry West" }
    },

    crops: {
      wheat:        { name: "Wheat", role: "Grain", best: "Cool summers; 12–22°C at flowering, harmed above 30°C" },
      barley:       { name: "Barley", role: "Grain / malting", best: "Fastest cereal (70–90 days); tolerates drought and cool seasons" },
      oats:         { name: "Oats", role: "Grain / forage", best: "Cool, moist summers; heat-sensitive" },
      potato:       { name: "Potato", role: "Food / cash crop", best: "Tubers form best at 15–20°C; sensitive to frost and warm nights" },
      rapeseed:     { name: "Rapeseed", role: "Oil / export", best: "Cool-season; heat above 27–30°C at flowering hurts; uses more water than wheat" },
      pea:          { name: "Field pea", role: "Protein / nitrogen", best: "Fixes nitrogen; suits cool, short seasons" },
      buckwheat:    { name: "Buckwheat", role: "Grain / honey", best: "Grows on poor soils; very frost-sensitive" },
      alfalfa:      { name: "Yellow alfalfa", role: "Perennial forage", best: "Winter-hardy, drought-tolerant, fixes nitrogen" },
      seabuckthorn: { name: "Sea buckthorn", role: "Perennial fruit / windbreak", best: "Tolerates −40 to +40°C, deep roots; for field edges and shelterbelts" },
      vegetables:   { name: "Vegetables", role: "Cabbage, carrot, turnip", best: "Cool summers, usually irrigated; frost-sensitive" }
    },

    strategies: {
      baseline: {
        name: "Current practice", crops: "Continuous wheat",
        benefit: "Fits existing machinery, markets and farmer experience.",
        catch: "Growing one crop every year drains soil moisture, organic matter and nitrogen and builds up pests and disease. Fields sit bare after harvest and blow away.",
        evidence: "Over 75% of Mongolia's cropland is cereals, mostly wheat. Hot, dry weather from May to July cut 2025 yields (FAO GIEWS).",
        gaps: "Your field's organic matter, nitrogen and pest history.",
        tableSoil: "⚠️ Soil declines", tableWater: "Medium", tableFeed: "❌ Low"
      },
      soil_protector: {
        name: "The Soil Protector", crops: "Wheat ➔ Rapeseed",
        benefit: "Rapeseed taproots loosen compacted soil and break cereal disease cycles. Rapeseed sells for about 3× the price of wheat, with export demand.",
        catch: "Rapeseed uses more water than wheat and leaves little stubble, so winter wind protection is weak. Heat above 27–30°C at flowering hurts yield. Combines must be adjusted to avoid losing small seeds.",
        evidence: "A Mongolian field study found rapeseed fields use more water than wheat and store less during fallow (Miyasaka et al., 2021). A rapeseed oil plant operates in Selenge.",
        gaps: "Sclerotinia disease risk, distance to a crushing plant, seed quality.",
        tableSoil: "✅ Taproots loosen soil", tableWater: "High", tableFeed: "➖ Meal only"
      },
      livestock_saver: {
        name: "The Livestock Saver", crops: "Wheat ➔ Yellow alfalfa (3–4 yrs)",
        benefit: "Fixes nitrogen and covers the soil for years, shielding it from wind. Produces high-protein hay for dzud winters.",
        catch: "Slow first-year establishment needs weed control. Common purple alfalfa often dies over winter — choose yellow-flowered (falcata) types.",
        evidence: "Yellow-flowered alfalfa is more drought-tolerant and winter-hardy than common alfalfa (USDA NRCS). ADB trials found brome, alfalfa and wheatgrass mixes performed best, especially irrigated.",
        gaps: "Yellow alfalfa seed supply, haying equipment, local herder demand.",
        tableSoil: "⭐ Nitrogen + cover", tableWater: "Medium", tableFeed: "⭐ Very high"
      },
      legume_boost: {
        name: "The Nitrogen Builder", crops: "Wheat ➔ Field pea ➔ Barley",
        benefit: "Peas leave nitrogen for the next crop, cutting fertilizer costs. Barley matures fast and can replace imported malting barley.",
        catch: "Peas are drought-sensitive at flowering and lodge at harvest, needing suitable equipment. The local pea market is still small.",
        evidence: "In Mongolia's central cropping region, 3-year rotations with legumes raised mobile soil nitrogen by 45–76% (Myagmarsuren & Begz, 2024).",
        gaps: "Pea seed supply, buyers, rhizobium inoculant availability.",
        tableSoil: "⭐ Adds nitrogen", tableWater: "Low–medium", tableFeed: "➖ Medium"
      },
      short_season: {
        name: "The Short-Season Feeder", crops: "Barley ➔ Oat + pea hay",
        benefit: "Both mature quickly, suiting northern areas with early frosts. Oat-pea mixes give high-protein hay and the peas add nitrogen.",
        catch: "Oats struggle in hot, dry summers. Hay prices swing from year to year.",
        evidence: "ADB-supported trials showed strong yields for peas, oats, rye and oat-pea / barley-pea mixes.",
        gaps: "Haying and baling equipment; local herder demand.",
        tableSoil: "✅ Cover + nitrogen", tableWater: "Low–medium", tableFeed: "⭐ High"
      },
      potato_cash: {
        name: "The Cash Crop Rotation", crops: "Potato ➔ Barley",
        benefit: "Potatoes are profitable with strong domestic demand; following with barley breaks potato pest and disease cycles.",
        catch: "Potatoes need lots of water and labour (usually irrigated) and are sensitive to frost and warm nights. Soil is loose and bare after harvest.",
        evidence: "Töv produces over 40% of Mongolia's potatoes. 2024 potato, barley and oat output was well above average (FAO GIEWS).",
        gaps: "Irrigation source, storage, seed-potato quality.",
        tableSoil: "⚠️ Erosion risk", tableWater: "High", tableFeed: "➖ Low"
      },
      low_input: {
        name: "The Low-Input Option", crops: "Wheat ➔ Buckwheat",
        benefit: "Buckwheat grows on poor soils with little fertilizer, smothers weeds and supports honey bees.",
        catch: "Very frost-sensitive, so risky where the frost-free season is short. Only grown in Mongolia since 2010, so local experience is limited.",
        evidence: "Variety trials at Bornuur, Töv; buckwheat can survive in virtually all regions of Mongolia (MJAS).",
        gaps: "Suitable varieties, hulling facilities, market price.",
        tableSoil: "✅ Suppresses weeds", tableWater: "Low", tableFeed: "❌ Low"
      },
      shelterbelt: {
        name: "Windbreak + Fruit", crops: "Sea buckthorn rows + Barley",
        benefit: "Sea buckthorn rows along field edges slow the wind, trap snow and fix nitrogen. The berries are high-value and supply 20+ processors.",
        catch: "Perennial: fruit only after 3–4 years and it permanently occupies part of the field. Needs watering while young.",
        evidence: "Cultivated in Mongolia for 40+ years on over 7,000 ha; tolerates −40 to +40°C and drought.",
        gaps: "Seedling supply, fencing, harvest labour.",
        tableSoil: "⭐ Wind shelter", tableWater: "Medium", tableFeed: "➖ Low"
      }
    }
  }
};
