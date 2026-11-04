/*
 * Siatka Powiązań — warstwa epoki: Polska 1989–1999.
 * Wspólne dla wszystkich miast: imiona, role, miejsca, przedmioty, cechy,
 * alibi, typy zbrodni i sceny. Realia konkretnych lat mają zakres `years`.
 *
 * Konwencje tekstowe:
 *   [męska|żeńska]    wariant wg płci postaci; dla przedmiotów [m|f|n]
 *   {klucz}           wstawka z miasta, roku lub sprawy, np. {street}, {market_on},
 *                     {team}, {church_at}, {money}, {police_dat}, {district_na}
 *   {t:"…", years:[od,do]}   tekst tylko dla danych lat (włącznie)
 *
 * Wszystko, co wpływa na logikę (klucze, cechy, przedmioty, miejsca), jest danymi.
 * Smaczki tylko ubierają fakty i niczego nie przesądzają.
 */
(function (root) {
  const BASE = {
    years: [1989, 1999],
    months: ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"],
    detective: "Wacław Grzyb",

    /* ------------------------------------------------------------------ */
    /* IMIONA I NAZWISKA                                                    */
    /* ------------------------------------------------------------------ */
    /* Imiona wg pokolenia (w latach 90.): old = urodzeni do ok. 1935, mid = 1936–1960, young = po 1960.
       Rola ma `age` (jedno albo lista); bez `age` imię może być z każdego pokolenia. */
    names: {
      m: {
        old:   ["Henryk","Tadeusz","Stanisław","Kazimierz","Edward","Józef","Czesław","Mieczysław","Zenon","Eugeniusz",
                "Bronisław","Witold","Władysław","Bolesław","Alojzy","Zygmunt","Ludwik","Florian","Antoni","Stefan",
                "Feliks","Ignacy","Franciszek","Wincenty","Leon","Walenty","Teodor"],
        mid:   ["Roman","Zbigniew","Mirosław","Ryszard","Jerzy","Wiesław","Andrzej","Marek","Zdzisław","Bogdan",
                "Leszek","Janusz","Waldemar","Lech","Sławomir","Jan","Ireneusz","Bogusław","Edmund","Romuald",
                "Lucjan","Gerard","Marian","Karol","Bernard"],
        young: ["Grzegorz","Krzysztof","Jacek","Wojciech","Dariusz","Tomasz","Piotr","Adam","Jarosław","Robert",
                "Artur","Mariusz","Paweł","Marcin","Michał","Rafał","Sebastian","Łukasz","Przemysław","Radosław",
                "Daniel","Bartosz","Maciej","Szymon","Damian","Jakub","Arkadiusz","Kamil"]
      },
      f: {
        old:   ["Jadwiga","Wanda","Stanisława","Zofia","Genowefa","Kazimiera","Helena","Leokadia","Czesława","Marianna",
                "Regina","Janina","Bronisława","Henryka","Ludmiła","Aniela","Apolonia","Józefa","Franciszka","Rozalia",
                "Eugenia","Władysława","Stefania","Cecylia","Pelagia","Waleria","Michalina"],
        mid:   ["Bożena","Halina","Grażyna","Krystyna","Danuta","Teresa","Barbara","Elżbieta","Irena","Bogumiła",
                "Lucyna","Mirosława","Jolanta","Urszula","Ewa","Hanna","Alicja","Wiesława","Celina","Sabina",
                "Gabriela","Lidia","Zdzisława","Bogusława","Mariola","Elwira","Ryszarda"],
        young: ["Renata","Beata","Dorota","Iwona","Agnieszka","Małgorzata","Joanna","Anna","Edyta","Aneta",
                "Monika","Katarzyna","Marzena","Violetta","Magdalena","Justyna","Sylwia","Ilona","Kinga","Izabela",
                "Marta","Ewelina","Agata","Dominika","Karolina","Paulina","Patrycja"]
      }
    },
    /* [forma męska, forma żeńska] */
    surnames: [
      ["Kulesza","Kulesza"],["Sitek","Sitek"],["Morawski","Morawska"],["Wrzos","Wrzos"],["Pawlak","Pawlak"],
      ["Kowalczyk","Kowalczyk"],["Zając","Zając"],["Wróblewski","Wróblewska"],["Majewski","Majewska"],["Jabłoński","Jabłońska"],
      ["Sowa","Sowa"],["Malinowski","Malinowska"],["Grabowski","Grabowska"],["Kaczmarek","Kaczmarek"],["Piątek","Piątek"],
      ["Szczepański","Szczepańska"],["Borkowski","Borkowska"],["Lis","Lis"],["Dudek","Dudek"],["Wieczorek","Wieczorek"],
      ["Sadowski","Sadowska"],["Kurek","Kurek"],["Czarnecki","Czarnecka"],["Ostrowski","Ostrowska"],["Cieślak","Cieślak"],
      ["Rogalski","Rogalska"],["Nowicki","Nowicka"],["Gajewski","Gajewska"],["Mazur","Mazur"],["Jasiński","Jasińska"],
      ["Wilk","Wilk"],["Kalinowski","Kalinowska"],["Bąk","Bąk"],["Sobczak","Sobczak"],["Rutkowski","Rutkowska"],
      ["Michalak","Michalak"],["Krawczyk","Krawczyk"],["Przybylski","Przybylska"],["Gołębiowski","Gołębiowska"],["Kozłowski","Kozłowska"],
      ["Wysocki","Wysocka"],["Adamczyk","Adamczyk"],["Ziółkowski","Ziółkowska"],["Baran","Baran"],["Sikora","Sikora"],
      ["Chmielewski","Chmielewska"],["Tomaszewski","Tomaszewska"],["Zawadzki","Zawadzka"],["Kubiak","Kubiak"],["Pietrzak","Pietrzak"],
      ["Malina","Malina"],["Kos","Kos"],["Cichy","Cicha"],["Szulc","Szulc"],["Frankowski","Frankowska"]
    ],

    /* ------------------------------------------------------------------ */
    /* ROLE (wspólne). Miasta dokładają własne role i „robotnika”.          */
    /* access: miejsca, do których rola naturalnie ma klucz.               */
    /* ------------------------------------------------------------------ */
    roles: [
      { id:"dozorca", age:["mid","old"], m:"Dozorca kamienicy", f:"Dozorczyni kamienicy", access:["piwnica","pralnia","kotlownia"],
        outfit:{shape:"apron",c:"#6c7a8a",d:"#a9b4c0"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Zna każdego lokatora po krokach na schodach.","Prowadzi zeszyt, w którym zapisuje, kto o której wraca."] },
      { id:"administrator", age:"mid", m:"Administrator domu", f:"Administratorka domu", access:["piwnica","kotlownia","pralnia"],
        outfit:{shape:"collar",c:"#4f5560",d:"#d8d2c4"}, headwear:{m:[],f:[]},
        flavor:["Nosi przy pasku pęk kluczy, który dzwoni na całą klatkę."] },
      { id:"aptekarz", age:["mid","old"], m:"Aptekarz", f:"Aptekarka", access:["apteka"],
        outfit:{shape:"collar",c:"#f1f1ea",d:"#3e6b5c"}, headwear:{m:[],f:[]},
        flavor:["Pamięta, kto i kiedy kupował co mocniejszego.","Mówi powoli i bardzo dokładnie."] },
      { id:"mechanik", age:["young","mid"], m:"Mechanik", f:null, access:["garaz"],
        outfit:{shape:"plain",c:"#3d5a85",d:"#2b3f5e"}, headwear:{m:["kaszkiet",""]},
        flavor:["Ma czarne od smaru paznokcie.","Naprawia sąsiadom Maluchy po godzinach.",
                {t:"Przerabia auta sprowadzone z Niemiec, żeby przeszły przegląd.", years:[1991,1999]}] },
      { id:"stolarz", age:["mid","old"], m:"Stolarz", f:null, access:["warsztat"],
        outfit:{shape:"apron",c:"#6b4a2e",d:"#a5835a"}, headwear:{m:["kaszkiet",""]},
        flavor:["Pachnie trocinami i pokostem.","Od trzydziestu lat robi meble na zamówienie."] },
      { id:"fryzjer", age:["young","mid"], m:"Fryzjer", f:"Fryzjerka", access:["fryzjer"],
        outfit:{shape:"collar",c:"#e6d3dd",d:"#8c3b4a"}, headwear:{m:[],f:[]},
        flavor:["Wie o wszystkich plotkach w dzielnicy.","Robi trwałą i strzyże na „Bonda”."] },
      { id:"sklepowa", age:"mid", m:"Sprzedawca w spożywczym", f:"Sprzedawczyni w spożywczym", access:["sklep"],
        outfit:{shape:"apron",c:"#f1f1ea",d:"#b0423a"}, headwear:{m:[],f:[""]},
        flavor:["Zna godziny dostaw lepiej niż kierowca.",
                {t:"Wciąż odkłada spod lady dla znajomych.", years:[1989,1990]},
                {t:"Odkąd półki są pełne, narzeka, że ludzie nie mają pieniędzy.", years:[1990,1999]}] },
      { id:"kioskarz", age:["mid","old"], m:"Kioskarz", f:"Kioskarka", access:["kiosk"],
        outfit:{shape:"jacket",c:"#5d6b4f",d:"#c9b98f"}, headwear:{m:["beret"],f:["beret"]},
        flavor:["Odkłada stałym klientom gazetę „{gazeta}”.","Sprzedaje też żetony do budki telefonicznej.",
                {t:"Sprzedaje kupony Totka i zdrapki.", years:[1993,1999]}] },
      { id:"palacz", age:"mid", m:"Palacz w kotłowni", f:null, access:["kotlownia"],
        outfit:{shape:"plain",c:"#3a3a3a",d:"#5a5a5a"}, headwear:{m:["kaszkiet"]},
        flavor:["Ma twarz szarą od miału.","Od października mieszka właściwie w kotłowni."] },
      { id:"dzialkowiec", age:"old", m:"Działkowiec", f:"Działkowiczka", access:["dzialka"],
        outfit:{shape:"jacket",c:"#4c6b3a",d:"#a3b37a"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Hoduje pomidory, o których mówi z czułością.","Co roku wygrywa konkurs na największą dynię."] },
      { id:"hydraulik", age:"mid", m:"Hydraulik", f:null, access:["kotlownia","piwnica"],
        outfit:{shape:"plain",c:"#2f4f6f",d:"#5b7a99"}, headwear:{m:["kaszkiet",""]},
        flavor:["Zawsze ma przy sobie klucz nastawny.","Za fuchy bierze w markach."] },
      { id:"maglarka", age:"old", m:null, f:"Maglarka", access:["pralnia"],
        outfit:{shape:"apron",c:"#7d6a8f",d:"#d8cfe3"}, headwear:{f:["chustka"]},
        flavor:["Pierze i magluje dla połowy kamienicy.","Wie, kto ma nową pościel, a kto łata starą."] },
      { id:"emeryt", age:"old", m:"Emerytowany kolejarz", f:"Emerytowana nauczycielka", access:[],
        outfit:{shape:"collar",c:"#59493b",d:"#c8b89c"}, headwear:{m:["kolejarz",""],f:[""]},
        flavor:["Cały dzień spędza przy oknie z poduszką pod łokciami.","Pisze listy do gazety „{gazeta}” o dziurach w chodnikach."] },
      { id:"taksowkarz", age:"mid", m:"Taksówkarz", f:null, access:[],
        outfit:{shape:"jacket",c:"#2b2b2b",d:"#d9a648"}, headwear:{m:["kaszkiet",""]},
        flavor:["Jeździ na kursy z postoju przy {dworzec}.","Zna każdy skrót w mieście.",
                {t:"Jeździ na „radio taxi” i ma w aucie krótkofalówkę.", years:[1991,1999]}] },
      { id:"listonosz", age:["young","mid"], m:"Listonosz", f:"Listonoszka", access:[],
        outfit:{shape:"collar",c:"#3e4a6b",d:"#c9a646"}, headwear:{m:["kolejarz"],f:[""]},
        flavor:["Zna wszystkie skrzynki na pamięć.","Roznosi renty i wie, kto ile dostaje."] },
      { id:"student", age:"young", m:"Student {uni}", f:"Studentka {uni}", access:[],
        outfit:{shape:"jacket",c:"#7a3b3b",d:"#d8c3a5"}, headwear:{m:[""],f:[""]},
        flavor:["Wynajmuje pokój u starszej pani na trzecim piętrze.","Słucha Kultu na kaseciaku tak głośno, że słychać na podwórku."] },
      { id:"handlarz", age:["young","mid"], m:"Handlarz {market_from}", f:"Handlarka {market_from}", access:[], years:[1989,1999],
        outfit:{shape:"jacket",c:"#7a6a3b",d:"#c9b98f"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Liczy pieniądze szybciej niż kasa fiskalna.",
                {t:"Sprzedaje dżinsy „prosto z Turcji”.", years:[1990,1997]},
                {t:"Wozi towar z Berlina Zachodniego w torbach w kratę.", years:[1989,1990]}] },
      { id:"pielegniarka", age:["young","mid"], m:"Pielęgniarz", f:"Pielęgniarka", access:[],
        outfit:{shape:"collar",c:"#f1f1ea",d:"#6f8fae"}, headwear:{m:[""],f:[""]},
        flavor:["Pracuje na zmiany w {szpital}.","Ma zawsze przy sobie plastry i miętówki."] },
      { id:"motorniczy", age:"mid", m:"Motorniczy", f:"Motorniczka", access:[],
        outfit:{shape:"collar",c:"#5c2f2f",d:"#d9a648"}, headwear:{m:["kolejarz"],f:["kolejarz"]},
        flavor:["Zna rozkład jazdy na pamięć.","Po służbie jeszcze godzinę słyszy dzwonek tramwaju."] },
      { id:"lokator", age:["young","mid","old"], m:"Lokator z parteru", f:"Lokatorka z parteru", access:[],
        outfit:{shape:"jacket",c:"#5a5f6a",d:"#b9bcc2"}, headwear:{m:[""],f:[""]},
        flavor:["Mieszka tuż przy bramie i słyszy każde wejście.","Hoduje kanarka, który śpiewa od szóstej rano."] },
      { id:"cinkciarz", age:["young","mid"], m:"Cinkciarz", f:"Cinkciarka", access:[], years:[1989,1989],
        outfit:{shape:"jacket",c:"#3b3054",d:"#c0b0d8"}, headwear:{m:[""],f:[""]},
        flavor:["Pod hotelem pyta przechodniów, czy mają dolary.","Nosi złoty sygnet i kurtkę z ortalionu."] },
      { id:"bylycinkciarz", age:"mid", m:"Były cinkciarz", f:"Była cinkciarka", access:[], years:[1990,1995],
        outfit:{shape:"jacket",c:"#3b3054",d:"#c0b0d8"}, headwear:{m:[""],f:[""]},
        flavor:["Wciąż zna kurs dolara na pamięć, choć kantory odebrały [mu|jej] zarobek.","Nosi złoty sygnet i kurtkę z ortalionu."] },
      { id:"krawcowa", age:["mid","old"], m:"Krawiec", f:"Krawcowa", access:[],
        outfit:{shape:"collar",c:"#8a6d55",d:"#e8d9c1"}, headwear:{m:[""],f:[""]},
        flavor:["Przerabia płaszcze po rodzicach na modne kurtki.","Szpilki trzyma w ustach podczas rozmowy."] },
      { id:"organista", age:["mid","old"], m:"Organista z parafii", f:null, access:[],
        outfit:{shape:"collar",c:"#2b2b33",d:"#e6e6e6"}, headwear:{m:[""]},
        flavor:["Gra na mszy wieczornej {church_at}.","Zna wszystkie śluby i pogrzeby w dzielnicy."] },
      { id:"wideo", age:"young", m:"Właściciel wypożyczalni kaset", f:"Właścicielka wypożyczalni kaset", access:[], years:[1990,1999],
        outfit:{shape:"jacket",c:"#1f3a5a",d:"#e0662b"}, headwear:{m:[""],f:[""]},
        flavor:["Zna na pamięć wszystkie filmy z Van Damme’em.","Kasety z hitami trzyma pod ladą dla stałych klientów."] },
      { id:"akwizytor", age:"young", m:"Akwizytor", f:"Akwizytorka", access:[], years:[1991,1999],
        outfit:{shape:"collar",c:"#2b2b33",d:"#d8d2c4"}, headwear:{m:[""],f:[""]},
        flavor:["Chodzi po domach z garnkami, odkurzaczami i wielkim uśmiechem.","Nie przyjmuje odmowy za odpowiedź."] },
      { id:"ochroniarz", age:"young", m:"Ochroniarz", f:null, access:[], years:[1992,1999],
        outfit:{shape:"plain",c:"#1f1f22",d:"#3a3a40"}, headwear:{m:[""]},
        flavor:["Pilnuje hurtowni na nocną zmianę.","Nosi czarną kurtkę bomberkę nawet w lipcu."] },
      { id:"prywaciarz", age:["young","mid"], m:"Właściciel szczęki z ciuchami", f:"Właścicielka szczęki z ciuchami", access:[], years:[1990,1999],
        outfit:{shape:"jacket",c:"#8c3b4a",d:"#e6d3dd"}, headwear:{m:[""],f:[""]},
        flavor:["Rano rozkłada blaszaną budkę, wieczorem ją zamyka na kłódkę.","Zawsze ma drobne, ale nigdy nie daje paragonu."] }
    ],

    /* ------------------------------------------------------------------ */
    /* MIEJSCA (skąd mogą zniknąć przedmioty)                              */
    /* ------------------------------------------------------------------ */
    locations: [
      { id:"garaz", name:"Garaż na podwórku", label:"Garaż", gen:"garażu", in:"w garażu", from:"z garażu", icon:"garage",
        open:["Zamek od dawna zepsuty, drzwi domyka się na drut.", "Brama garażu stoi uchylona, bo zacina się na mrozie."],
        desc:["Murowany boks w oficynie, z kanałem i półkami pełnymi narzędzi.","Blaszane drzwi, w środku zapach smaru i benzyny."] },
      { id:"apteka", name:"Apteka „Pod Orłem”", label:"Apteka", gen:"apteki", in:"w aptece", from:"z zaplecza apteki", icon:"pharmacy",
        open:["Tylne drzwi od podwórka nie domykają się, wie o tym cała kamienica.", "Wieczorem zaplecze stoi otwarte dla dostawców."],
        desc:["Apteka na rogu {street2}, z drewnianymi szufladami i zapleczem od podwórka.","Zamykana o 19:00, tylne drzwi wychodzą na podwórko."] },
      { id:"piwnica", name:"Piwnica pod kamienicą", label:"Piwnica", gen:"piwnicy", in:"w piwnicy", from:"z piwnicy", icon:"cellar",
        open:["Drzwi do piwnic nie mają zamka od czasów wojny.", "Kłódkę na drzwiach ktoś dawno przeciął i nikt nie założył nowej."],
        desc:["Wilgotny korytarz z komórkami lokatorów i jedną gołą żarówką.","Zejście od podwórka, zapach ziemniaków i stęchlizny."] },
      { id:"warsztat", name:"Warsztat stolarski", label:"Warsztat", gen:"warsztatu", in:"w warsztacie", from:"z warsztatu", icon:"workshop",
        open:["Stolarz zostawia klucz pod wycieraczką, o czym wie cała kamienica.", "Drzwi stoją otwarte, żeby schły świeżo lakierowane meble."],
        desc:["Ciasny warsztat w oficynie, wióry po kostki.","Strug, imadło i tablica z obrysami narzędzi."] },
      { id:"pralnia", name:"Pralnia na strychu", label:"Pralnia", gen:"pralni", in:"w pralni", from:"z pralni", icon:"laundry",
        open:["Drzwi na strych nigdy się nie zamyka.", "Klucz do pralni wisi na gwoździu tuż przy drzwiach."],
        desc:["Wspólna pralnia pod dachem, z kotłem i sznurami do suszenia.","Grafik prania przypięty pinezką do drzwi."] },
      { id:"dzialka", name:"Altana na działkach", label:"Altana", gen:"altany", in:"w altanie", from:"z altany", icon:"shed",
        open:["Altana zamyka się na skobel, który otworzy każdy.", "W płocie działek jest dziura od strony torów."],
        desc:["Drewniana altana przy torach, z beczką na deszczówkę.","Na ogródkach działkowych na skraju {district_gen}."] },
      { id:"kiosk", name:"Kiosk Ruchu", label:"Kiosk", gen:"kiosku", in:"w kiosku", from:"z kiosku", icon:"kiosk",
        open:["Kioskarz wpuszcza na zaplecze każdego, kto pomoże nosić paczki z prasą.", "Tylne drzwiczki kiosku od dawna nie mają zamka."],
        desc:["Zielony kiosk z okienkiem, pełen gazet i papierosów.","Stoi przy przystanku tramwajowym na {street2}."] },
      { id:"sklep", name:"Sklep spożywczy „Społem”", label:"Sklep", gen:"sklepu", in:"na zapleczu sklepu", from:"z zaplecza sklepu", icon:"shop",
        open:["Drzwi na zaplecze stoją otwarte, bo ciągle ktoś wnosi skrzynki.", "Na zaplecze wchodzi się prosto z podwórka, bez żadnego zamka."],
        desc:["Spożywczy z ladą chłodniczą i zapleczem pełnym skrzynek.","Dostawa chleba o szóstej, kolejka jeszcze przed otwarciem."] },
      { id:"fryzjer", name:"Zakład fryzjerski", label:"Fryzjer", gen:"zakładu fryzjerskiego", in:"w zakładzie fryzjerskim", from:"z zakładu fryzjerskiego", icon:"barber",
        open:["Zakład jest otwarty do wieczora i każdy może wejść.", "W zakładzie ciągle ktoś czeka w kolejce, a zaplecza nikt nie pilnuje."],
        desc:["Dwa fotele, suszarka-hełm i lustro z pęknięciem.","Na szybie wywieszka „Trwała ondulacja”."] },
      { id:"kotlownia", name:"Kotłownia", label:"Kotłownia", gen:"kotłowni", in:"w kotłowni", from:"z kotłowni", icon:"boiler",
        open:["Drzwi do kotłowni stoją otwarte, żeby piec miał ciąg.", "Zamek od kotłowni zepsuł się zeszłej zimy."],
        desc:["Gorąca, ciemna kotłownia z pryzmą koksu.","Piec huczy przez cały sezon grzewczy."] }
    ],

    /* ------------------------------------------------------------------ */
    /* PRZEDMIOTY                                                           */
    /* tags: tepe | ostre | sznur | wlam | trucizna | ogien                 */
    /* g: rodzaj gramatyczny (m/f/n)                                        */
    /* ------------------------------------------------------------------ */
    items: [
      { id:"lewar", name:"Żeliwny lewar", label:"Lewar", acc:"lewar", g:"m", tags:["tepe"], origins:["garaz"],
        icon:{shape:"bar",p:{a:"#2b2b2e",l:"#6b6b72"}}, desc:["Ciężki, żeliwny, z wytartym uchwytem."] },
      { id:"klucz", name:"Klucz francuski", label:"Klucz", acc:"klucz francuski", g:"m", tags:["tepe"], origins:["garaz","warsztat"],
        icon:{shape:"wrench",p:{a:"#8a8f99",l:"#c9ced6"}}, desc:["Duży klucz nastawny, prawie kilo żelaza."] },
      { id:"lom", name:"Stalowy łom", label:"Łom", acc:"łom", g:"m", tags:["wlam","tepe"], origins:["garaz","kotlownia","piwnica"],
        icon:{shape:"bar",p:{a:"#7a2b2b",l:"#b04a4a"}}, desc:["Czerwony łom, zagięty na końcu."] },
      { id:"lyzka", name:"Łyżka do opon", label:"Łyżka", acc:"łyżkę do opon", g:"f", tags:["wlam"], origins:["garaz"],
        icon:{shape:"bar",p:{a:"#3d5a85",l:"#8a8f99"}}, desc:["Płaska, stalowa łyżka do zdejmowania opon."] },
      { id:"kanister", name:"Kanister benzyny", label:"Kanister", acc:"kanister benzyny", g:"m", tags:["ogien"], origins:["garaz"],
        icon:{shape:"can",p:{a:"#2b2b2b",b:"#3f6b3a",w:"#c9d9a8"}}, desc:["Wojskowy kanister, pełny w trzech czwartych."] },
      { id:"linka", name:"Linka holownicza", label:"Linka", acc:"linkę holowniczą", g:"f", tags:["sznur"], origins:["garaz"],
        icon:{shape:"rope",p:{a:"#c9772b"}}, desc:["Gruba pomarańczowa linka z hakami."] },
      { id:"mozdzierz", name:"Mosiężny moździerz", label:"Moździerz", acc:"moździerz", g:"m", tags:["tepe"], origins:["apteka"],
        icon:{shape:"mortar",p:{p:"#a8823a",y:"#c99a3e",o:"#f1d27a"}}, desc:["Ciężki mosiężny moździerz z tłuczkiem."] },
      { id:"luminal", name:"Fiolka luminalu", label:"Luminal", acc:"fiolkę luminalu", g:"f", tags:["trucizna"], origins:["apteka"],
        icon:{shape:"vial",p:{a:"#3a3a3a",b:"#7a5a2b",w:"#e8dcc0"}}, desc:["Brązowa fiolka z silnym środkiem nasennym."] },
      { id:"trutka", name:"Trutka na szczury", label:"Trutka", acc:"trutkę na szczury", g:"f", tags:["trucizna"], origins:["piwnica","sklep"],
        icon:{shape:"box",p:{b:"#b0423a",w:"#eee8dc",h:"#2b2b2b"}}, desc:["Czerwone pudełko z trupią czaszką na etykiecie."] },
      { id:"siekiera", name:"Siekiera", label:"Siekiera", acc:"siekierę", g:"f", tags:["ostre","tepe"], origins:["piwnica","dzialka"],
        icon:{shape:"axe",p:{h:"#8a8f99",a:"#7a5232"}}, desc:["Stara siekiera do rąbania podpałki."] },
      { id:"nafta", name:"Butelka nafty", label:"Nafta", acc:"butelkę nafty", g:"f", tags:["ogien"], origins:["piwnica"],
        icon:{shape:"bottle",p:{a:"#3a3a3a",h:"#6b6b72",b:"#5e8aa0",w:"#e8dcc0"}}, desc:["Butelka po oranżadzie, a w niej nafta do lampy."] },
      { id:"mlotek", name:"Młotek ciesielski", label:"Młotek", acc:"młotek", g:"m", tags:["tepe"], origins:["warsztat"],
        icon:{shape:"hammer",p:{h:"#5a5f6a",a:"#a5835a"}}, desc:["Młotek z rozwidlonym obuchem do wyciągania gwoździ."] },
      { id:"dluto", name:"Dłuto", label:"Dłuto", acc:"dłuto", g:"n", tags:["ostre"], origins:["warsztat"],
        icon:{shape:"blade",p:{h:"#c9ced6",a:"#a5835a"}}, desc:["Ostro naostrzone dłuto z bukową rączką."] },
      { id:"srubokret", name:"Duży śrubokręt", label:"Śrubokręt", acc:"śrubokręt", g:"m", tags:["wlam"], origins:["warsztat"],
        icon:{shape:"blade",p:{h:"#8a8f99",a:"#c22a2a"}}, desc:["Śrubokręt płaski, długi na łokieć."] },
      { id:"rozpuszczalnik", name:"Puszka rozpuszczalnika", label:"Rozpuszczalnik", acc:"puszkę rozpuszczalnika", g:"f", tags:["ogien"], origins:["warsztat"],
        icon:{shape:"can",p:{a:"#5a5f6a",b:"#c9a646",w:"#2b2b2b"}}, desc:["Blaszana puszka rozcieńczalnika do farb."] },
      { id:"sznur", name:"Sznur do bielizny", label:"Sznur", acc:"sznur", g:"m", tags:["sznur"], origins:["pralnia"],
        icon:{shape:"rope",p:{a:"#d8d2c4"}}, desc:["Konopny sznur, odcięty z suszarni."] },
      { id:"zelazko", name:"Żeliwne żelazko", label:"Żelazko", acc:"żelazko", g:"n", tags:["tepe"], origins:["pralnia"],
        icon:{shape:"iron",p:{a:"#2b2b2b",h:"#5a5f6a"}}, desc:["Stare żelazko na duszę, ciężkie jak cegła."] },
      { id:"sekator", name:"Sekator", label:"Sekator", acc:"sekator", g:"m", tags:["ostre"], origins:["dzialka"],
        icon:{shape:"blade",p:{h:"#c9ced6",a:"#3f6b3a"}}, desc:["Sekator do róż z zielonymi rączkami."] },
      { id:"mszyce", name:"Środek na mszyce", label:"Środek", acc:"środek na mszyce", g:"m", tags:["trucizna"], origins:["dzialka"],
        icon:{shape:"box",p:{b:"#3f6b3a",w:"#eee8dc",h:"#c9a646"}}, desc:["Proszek w torebce z napisem „Trucizna! Chronić przed dziećmi”."] },
      { id:"lopata", name:"Łopata", label:"Łopata", acc:"łopatę", g:"f", tags:["tepe"], origins:["dzialka","kotlownia"],
        icon:{shape:"shovel",p:{h:"#6b6b72",a:"#7a5232"}}, desc:["Szeroka łopata z drewnianym trzonkiem."] },
      { id:"nozyk", name:"Nożyk do kartonów", label:"Nożyk", acc:"nożyk", g:"m", tags:["ostre"], origins:["kiosk"],
        icon:{shape:"blade",p:{h:"#c9ced6",a:"#c9a646"}}, desc:["Nożyk z wysuwanym ostrzem do rozcinania paczek z prasą."] },
      { id:"zapalki", name:"Pudełko zapałek", label:"Zapałki", acc:"pudełko zapałek", g:"n", tags:["ogien"], origins:["kiosk","kotlownia"],
        icon:{shape:"box",p:{b:"#c9a646",w:"#eee8dc",h:"#b0423a"}}, desc:["Duże kuchenne pudełko zapałek."] },
      { id:"denaturat", name:"Butelka denaturatu", label:"Denaturat", acc:"butelkę denaturatu", g:"f", tags:["ogien","trucizna"], origins:["sklep"],
        icon:{shape:"bottle",p:{a:"#3a3a3a",h:"#6b6b72",b:"#6b4a8a",w:"#e8dcc0"}}, desc:["Fioletowa butelka z etykietą „Nie do picia”."] },
      { id:"noz", name:"Nóż do wędlin", label:"Nóż", acc:"nóż do wędlin", g:"m", tags:["ostre"], origins:["sklep"],
        icon:{shape:"blade",p:{h:"#e6e6e6",a:"#2b2b2b"}}, desc:["Długi nóż z czarną rączką, ostrzony co rano."] },
      { id:"brzytwa", name:"Brzytwa", label:"Brzytwa", acc:"brzytwę", g:"f", tags:["ostre"], origins:["fryzjer"],
        icon:{shape:"blade",p:{h:"#e6e6e6",a:"#d8d2c4"}}, desc:["Brzytwa z rączką z kości, ostrzona na pasku."] },
      { id:"lakier", name:"Lakier do włosów", label:"Lakier", acc:"lakier do włosów", g:"m", tags:["ogien"], origins:["fryzjer"],
        icon:{shape:"bottle",p:{a:"#b0423a",h:"#e6e6e6",b:"#d48aa8",w:"#f5e9ef"}}, desc:["Puszka lakieru w sprayu, łatwopalny."] },
      { id:"pogrzebacz", name:"Pogrzebacz", label:"Pogrzebacz", acc:"pogrzebacz", g:"m", tags:["tepe","wlam"], origins:["kotlownia"],
        icon:{shape:"bar",p:{a:"#1f1f22",l:"#4a4a52"}}, desc:["Długi, kuty pogrzebacz od pieca."] }
      ,
      /* --- uduszenia: sznury i kable w wielu miejscach --- */
      { id:"przedluzacz", name:"Przedłużacz", label:"Przedłużacz", acc:"przedłużacz", g:"m", tags:["sznur"], origins:["warsztat","garaz","zajezdnia"],
        icon:{shape:"rope",p:{a:"#e8e8e0"}}, desc:["Pięciometrowy przedłużacz z gumową wtyczką."] },
      { id:"lina", name:"Lina konopna", label:"Lina", acc:"linę konopną", g:"f", tags:["sznur"], origins:["piwnica","kotlownia","lampownia"],
        icon:{shape:"rope",p:{a:"#a5835a"}}, desc:["Gruba konopna lina, zwinięta na haku."] },
      { id:"pasek", name:"Pasek do ostrzenia brzytwy", label:"Pasek", acc:"pasek do ostrzenia brzytwy", g:"m", tags:["sznur"], origins:["fryzjer"],
        icon:{shape:"rope",p:{a:"#6b4a2e"}}, desc:["Skórzany pasek, wygładzony latami ostrzenia."] },
      { id:"szpagat", name:"Szpagat do paczek", label:"Szpagat", acc:"szpagat", g:"m", tags:["sznur"], origins:["kiosk","sklep","piekarnia"],
        icon:{shape:"rope",p:{a:"#c9b98f"}}, desc:["Gruby sznurek, którym wiąże się paczki."] },
      { id:"drut", name:"Zwój drutu", label:"Drut", acc:"zwój drutu", g:"m", tags:["sznur"], origins:["dzialka","golebnik"],
        icon:{shape:"rope",p:{a:"#8a8f99"}}, desc:["Miękki, ocynkowany drut do podwiązywania i łatania siatki."] },

      /* --- przedmioty z miejsc, które mają tylko niektóre miasta (data/cities.js) --- */
      { id:"wioslo", name:"Wiosło", label:"Wiosło", acc:"wiosło", g:"n", tags:["tepe"], origins:["przystan"],
        icon:{shape:"shovel",p:{h:"#a5835a",a:"#7a5232"}}, desc:["Drewniane wiosło z okutym piórem."] },
      { id:"lina_cum", name:"Lina cumownicza", label:"Cuma", acc:"linę cumowniczą", g:"f", tags:["sznur"], origins:["przystan","szopa_rybacka","magazyn_port"],
        icon:{shape:"rope",p:{a:"#3e4a6b"}}, desc:["Mokra, granatowa lina do cumowania łodzi."] },
      { id:"bosak", name:"Bosak", label:"Bosak", acc:"bosak", g:"m", tags:["ostre","tepe"], origins:["przystan","szopa_rybacka"],
        icon:{shape:"bar",p:{a:"#7a5232",l:"#8a8f99"}}, desc:["Długi drąg z żelaznym hakiem na końcu."] },
      { id:"banka", name:"Bańka z ropą", label:"Bańka", acc:"bańkę z ropą", g:"f", tags:["ogien"], origins:["przystan","magazyn_port","zajezdnia"],
        icon:{shape:"can",p:{a:"#2b2b2b",b:"#7a2b2b",w:"#e8dcc0"}}, desc:["Blaszana bańka pełna ropy do silnika."] },
      { id:"odwaznik", name:"Żeliwny odważnik", label:"Odważnik", acc:"odważnik", g:"m", tags:["tepe"], origins:["szczeka"],
        icon:{shape:"weight",p:{a:"#5a5f6a",h:"#2b2b2e"}}, desc:["Kilogramowy odważnik od wagi szalkowej."] },
      { id:"noz_kapusta", name:"Nóż do kapusty", label:"Nóż", acc:"nóż do kapusty", g:"m", tags:["ostre"], origins:["szczeka"],
        icon:{shape:"blade",p:{h:"#e6e6e6",a:"#7a5232"}}, desc:["Szeroki nóż, którym kroi się kapustę na wagę."] },
      { id:"plandeka", name:"Linka od plandeki", label:"Linka", acc:"linkę od plandeki", g:"f", tags:["sznur"], origins:["szczeka"],
        icon:{shape:"rope",p:{a:"#4c6b3a"}}, desc:["Zielona linka, którą przywiązuje się plandekę do budki."] },
      { id:"walek", name:"Wałek do ciasta", label:"Wałek", acc:"wałek do ciasta", g:"m", tags:["tepe"], origins:["piekarnia"],
        icon:{shape:"bar",p:{a:"#c9a66b",l:"#e8d3a5"}}, desc:["Ciężki bukowy wałek, biały od mąki."] },
      { id:"noz_piekarski", name:"Nóż piekarski", label:"Nóż", acc:"nóż piekarski", g:"m", tags:["ostre"], origins:["piekarnia"],
        icon:{shape:"blade",p:{h:"#e6e6e6",a:"#c9a66b"}}, desc:["Długi nóż z ząbkami do krojenia chleba."] },
      { id:"podkowa", name:"Podkowa", label:"Podkowa", acc:"podkowę", g:"f", tags:["tepe"], origins:["stajnia"],
        icon:{shape:"horseshoe",p:{a:"#5a5f6a"}}, desc:["Zużyta podkowa, wisiała nad drzwiami na szczęście."] },
      { id:"bat", name:"Bat dorożkarski", label:"Bat", acc:"bat", g:"m", tags:["sznur"], origins:["stajnia"],
        icon:{shape:"rope",p:{a:"#2b2b2b"}}, desc:["Długi bat z plecionym rzemieniem."] },
      { id:"widly", name:"Widły", label:"Widły", acc:"widły", g:"n", tags:["ostre"], origins:["stajnia"],
        icon:{shape:"shovel",p:{h:"#8a8f99",a:"#7a5232"}}, desc:["Widły do siana o trzech zębach."] },
      { id:"statyw", name:"Statyw", label:"Statyw", acc:"statyw", g:"m", tags:["tepe"], origins:["piwnica_jazz","filmowka"],
        icon:{shape:"bar",p:{a:"#1f1f22",l:"#8a8f99"}}, desc:["Ciężki, stalowy statyw, rozkładany na trzy nogi."] },
      { id:"kabel", name:"Kabel od wzmacniacza", label:"Kabel", acc:"kabel", g:"m", tags:["sznur"], origins:["piwnica_jazz","filmowka"],
        icon:{shape:"rope",p:{a:"#1f1f22"}}, desc:["Gruby czarny kabel, zwinięty w ósemkę."] },
      { id:"wrzeciono", name:"Stalowe wrzeciono", label:"Wrzeciono", acc:"wrzeciono", g:"n", tags:["tepe"], origins:["przedzalnia"],
        icon:{shape:"bar",p:{a:"#8a8f99",l:"#c9ced6"}}, desc:["Wrzeciono z przędzarki, długie i ciężkie."] },
      { id:"nozyce", name:"Nożyce tkackie", label:"Nożyce", acc:"nożyce", g:"n", tags:["ostre"], origins:["przedzalnia"],
        icon:{shape:"blade",p:{h:"#c9ced6",a:"#2b2b2b"}}, desc:["Długie nożyce do cięcia tkaniny z bel."] },
      { id:"przedza", name:"Sznur przędzalniczy", label:"Sznur", acc:"sznur przędzalniczy", g:"m", tags:["sznur"], origins:["przedzalnia"],
        icon:{shape:"rope",p:{a:"#d8cfe3"}}, desc:["Mocny, skręcany sznur z bawełny."] },
      { id:"barwnik", name:"Barwnik anilinowy", label:"Barwnik", acc:"barwnik", g:"m", tags:["trucizna"], origins:["przedzalnia"],
        icon:{shape:"box",p:{b:"#6b4a8a",w:"#eee8dc",h:"#2b2b2b"}}, desc:["Słoik z fioletowym proszkiem i ostrzeżeniem o truciźnie."] },
      { id:"tasma", name:"Taśma filmowa", label:"Taśma", acc:"taśmę filmową", g:"f", tags:["ogien"], origins:["filmowka"],
        icon:{shape:"reel",p:{a:"#3a3a3a",b:"#c9a646",h:"#5a5f6a",w:"#e8dcc0"}}, desc:["Stara taśma na nitroceluloidzie, pali się jak papier nasączony benzyną."] },
      { id:"noz_ryby", name:"Nóż do ryb", label:"Nóż", acc:"nóż do ryb", g:"m", tags:["ostre"], origins:["szopa_rybacka"],
        icon:{shape:"blade",p:{h:"#c9d9e0",a:"#3e4a6b"}}, desc:["Wąski nóż do patroszenia ryb, ostry jak brzytwa."] },
      { id:"smola", name:"Puszka smoły", label:"Smoła", acc:"puszkę smoły", g:"f", tags:["ogien"], origins:["szopa_rybacka"],
        icon:{shape:"can",p:{a:"#1f1f22",b:"#2b2b2b",w:"#5a5f6a"}}, desc:["Smoła do uszczelniania łodzi."] },
      { id:"hak", name:"Hak portowy", label:"Hak", acc:"hak portowy", g:"m", tags:["ostre","wlam"], origins:["magazyn_port"],
        icon:{shape:"bar",p:{a:"#5a5f6a",l:"#c9ced6"}}, desc:["Stalowy hak, którym przeciąga się worki i skrzynie."] },
      { id:"golebie_srodek", name:"Środek na pasożyty", label:"Środek", acc:"środek na pasożyty", g:"m", tags:["trucizna"], origins:["golebnik"],
        icon:{shape:"vial",p:{a:"#3a3a3a",b:"#3f6b3a",w:"#e8dcc0"}}, desc:["Butelka środka dla gołębi. Dawka dla człowieka nie jest bezpieczna."] },
      { id:"lampa", name:"Lampa górnicza", label:"Lampa", acc:"lampę górniczą", g:"f", tags:["tepe"], origins:["lampownia"],
        icon:{shape:"lamp",p:{a:"#5a5f6a",h:"#2b2b2e",b:"#c9a646",w:"#f1d27a"}}, desc:["Ciężka lampa z akumulatorem, waży dobre trzy kilo."] },
      { id:"karbid", name:"Puszka karbidu", label:"Karbid", acc:"puszkę karbidu", g:"f", tags:["ogien"], origins:["lampownia"],
        icon:{shape:"can",p:{a:"#5a5f6a",b:"#8a8f99",w:"#2b2b2b"}}, desc:["Karbid do starych lamp. Z wodą wydziela palny gaz."] },
      { id:"drazek", name:"Drążek do zwrotnic", label:"Drążek", acc:"drążek do zwrotnic", g:"m", tags:["tepe","wlam"], origins:["zajezdnia"],
        icon:{shape:"bar",p:{a:"#c22a2a",l:"#2b2b2e"}}, desc:["Stalowy drążek, którym motorniczy przestawia zwrotnice."] }
    ],

    /* Losy przedmiotów: fakt o każdym dowodzie; reguła „fate” wskazuje los narzędzia */
    fates: {
      smietnik:   { item:"[Znaleziony|Znaleziona|Znalezione] rano w śmietniku na podwórku.", rule:"To, czego użył sprawca, ktoś znalazł rano w śmietniku na podwórku.", place:"przy śmietniku na podwórku" },
      tory:       { item:"[Znaleziony|Znaleziona|Znalezione] w krzakach przy torach.", rule:"To, czego użył sprawca, leżało rano w krzakach przy torach.", place:"przy torach" },
      park:       { item:"[Znaleziony|Znaleziona|Znalezione] w krzakach w parku.", rule:"To, czego użył sprawca, ktoś wypatrzył rano w krzakach w parku.", place:"w parku" },
      budowa:     { item:"[Znaleziony|Znaleziona|Znalezione] rano na placu budowy.", rule:"To, czego użył sprawca, robotnicy znaleźli rano na placu budowy.", place:"na placu budowy" },
      bazar:      { item:"[Znaleziony|Znaleziona|Znalezione] rano pod jedną z budek {market_on}.", rule:"To, czego użył sprawca, leżało rano pod budką {market_on}.", place:"{market_on}" },
      odniesione: { item:"Ktoś odniósł [go|ją|je] na miejsce dopiero rano.", rule:"To, czego użył sprawca, rano wróciło na swoje miejsce, jakby nic się nie stało." },
      brak:       { item:"Dotąd nie [odnaleziony|odnaleziona|odnalezione].", rule:"Tego, czego użył sprawca, do dziś nie odnaleziono." },
      studzienka: { item:"[Wyłowiony|Wyłowiona|Wyłowione] rano ze studzienki kanalizacyjnej.", rule:"To, czego użył sprawca, wyłowiono rano ze studzienki kanalizacyjnej." }
    },
    /* Nawyki: gdzie kto bywa codziennie. Reguła „dump” łączy los narzędzia z nawykiem sprawcy. */
    habits: {
      smietnik: ["Co wieczór wynosi śmieci za całą klatkę.","Codziennie przegląda pojemniki na podwórku w poszukiwaniu butelek do oddania.","Zbiera makulaturę z pojemników przy śmietniku."],
      tory:     ["Do pracy chodzi skrótem wzdłuż torów.","Codziennie zbiera złom przy torach.","Wieczorami spaceruje nasypem kolejowym."],
      park:     ["Codziennie rano biega po parku.","Każdego popołudnia karmi kaczki w parku.","Wieczorami gra w szachy na ławce w parku."],
      budowa:   ["Codziennie skraca sobie drogę przez plac budowy.","Dorabia jako stróż na pobliskiej budowie.","Zbiera z budowy ścinki desek na podpałkę."],
      bazar:    ["Codziennie rano robi zakupy {market_on}.","Bywa {market_on} każdego dnia, choćby po gazetę.","Ma znajomego handlarza {market_on} i zagląda do niego co dzień."]
    },
    dumpRule: ["To, czego użył sprawca, porzucono tam, gdzie sprawca bywa codziennie.",
               "Sprawca pozbył się tego, czego użył, po drodze, którą chodzi każdego dnia.",
               "To, czego użył sprawca, wyrzucono w miejscu, które zna jak własną kieszeń. Bywa tam codziennie."],

    /* ------------------------------------------------------------------ */
    /* CECHY (logika + jak się objawiają w tekście)                         */
    /* ------------------------------------------------------------------ */
    traits: {
      hand: {
        values:["left","right"],
        facts:{
          left:["Pisze lewą ręką.","[Podpisał|Podpisała] zeznanie lewą ręką.","Mańkut. Tak mówią o [nim|niej] sąsiedzi.","Zegarek nosi na prawym nadgarstku, bo jest [leworęczny|leworęczna].",
                "Podczas przesłuchania [przytrzymywał|przytrzymywała] kubek lewą ręką.","W szkole przywiązywali [mu|jej] lewą rękę do ławki, a i tak pisze lewą.",
                "Kawę miesza lewą ręką, a łyżeczkę odkłada na lewo od spodka.","Na zdjęciu z imienin trzyma kieliszek w lewej ręce."],
          right:["[Podpisał|Podpisała] zeznanie prawą ręką.","Pisze prawą ręką, starannie i drobno.","Lewą rękę ma od miesiąca w gipsie.","Zegarek nosi na lewym nadgarstku, jak większość praworęcznych.",
                 "Na środkowym palcu prawej ręki ma odcisk od długopisu.","Na przesłuchaniu [notował|notowała] coś prawą ręką w kalendarzyku.",
                 "Przy szachach przesuwa figury prawą ręką.","Kłódkę od piwnicy otwiera prawą ręką, lewą przytrzymując siatkę z zakupami."]
        },
        rule:{ left:["Ślady {where} zostawiła lewa ręka.","Odciski palców {where} układają się jak u mańkuta."],
               right:["Ślady {where} zostawiła prawa ręka.","Odciski palców {where} układają się jak u kogoś, kto wszystko robi prawą ręką."] },
        ruleMurder:{ left:["Kąt rany nie zostawia lekarzowi wątpliwości: uderzono z lewej ręki.","Lekarz nie ma wątpliwości: cios zadała lewa ręka."],
                     right:["Kąt rany nie zostawia lekarzowi wątpliwości: uderzono z prawej ręki.","Lekarz nie ma wątpliwości: cios zadała prawa ręka."] },
        ruleStrangle:{ left:["Ślady na szyi ofiary nie zostawiają lekarzowi wątpliwości: mocniej ciągnęła lewa ręka.","Węzeł na sznurze zawiązano od lewej strony, tak jak wiąże mańkut."],
                       right:["Ślady na szyi ofiary nie zostawiają lekarzowi wątpliwości: mocniej ciągnęła prawa ręka.","Węzeł na sznurze zawiązano od prawej strony, tak jak wiąże ktoś praworęczny."] },
        hint:"Porównaj, którą ręką posługują się podejrzani.",
        why:{ left:"jest [leworęczny|leworęczna]", right:"jest [praworęczny|praworęczna]" },
        whyFail:{ left:"jest [praworęczny|praworęczna]", right:"jest [leworęczny|leworęczna]" }
      },
      shoe: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Kwit", name:"Kwit od szewca", icon:"receipt", text:["Kwit z zakładu szewskiego przy {street2}: zelowanie i nowe fleki.","Buty w rozmiarze {v}, do odbioru w piątek. Na kwicie: {ini}."] },
                  { label:"Pudełko", name:"Pudełko po butach", icon:"receipt", text:["Pudełko po butach z domu towarowego, znalezione w piwnicy przy komórkach lokatorów.","Na boku rozmiar {v}. Na wieczku ktoś napisał flamastrem: {ini}."] }],
        values:{ m:[42,43,44,45], f:[37,38,39,40] },
        facts:["Nosi buty w rozmiarze {v}.","W przedpokoju stoją [jego|jej] kalosze, rozmiar {v}.","[Kupił|Kupiła] ostatnio na targu buty w rozmiarze {v}.",
               "Na wycieraczce przed drzwiami stoją [jego|jej] buty, rozmiar {v}.","Szewc z sąsiedztwa pamięta, że zelował [mu|jej] buty w rozmiarze {v}.",
               "Przy przesłuchaniu spisano rozmiar [jego|jej] butów: {v}.","W szafce trzyma dwie pary butów, obie w rozmiarze {v}.","Kapcie, w których [otworzył|otworzyła] drzwi, mają rozmiar {v}."],
        rule:["Uciekając, sprawca zostawił w błocie przed wejściem ślad buta w rozmiarze {v}.","Na wycieraczce został świeży odcisk podeszwy sprawcy, rozmiar {v}."],
        hint:"Sprawdź rozmiary butów.",
        why:"nosi buty w rozmiarze {v}",
        whyFail:"nosi buty w rozmiarze {v}"
      },
      height: {
        values:["tall","short"],
        facts:{
          tall:["Ma ponad metr dziewięćdziesiąt wzrostu.","Schyla się w każdych drzwiach.","Z daleka widać [go|ją] ponad tłumem na targu.",
                "Na zdjęciu klasowym stoi w ostatnim rzędzie, o głowę [wyższy|wyższa] od reszty.","Wkręca żarówki na klatce schodowej bez drabiny.",
                "Spodnie zawsze ma za krótkie, bo na [jego|jej] wzrost nic nie ma w sklepach.","W tramwaju musi się garbić, żeby nie uderzyć głową w sufit."],
          short:["Ma niecałe metr sześćdziesiąt.","Do górnej półki sięga ze stołka.","W tramwaju ledwo dosięga uchwytu.",
                 "W kolejce zza pleców innych nie widzi lady.","Na zdjęciu klasowym zawsze [stał|stała] w pierwszym rzędzie.",
                 "[Sam|Sama] żartuje, że ma metr pięćdziesiąt pięć w kapeluszu.","Do lustra w łazience musi stawać na palcach."]
        },
        rule:{ tall:["Sprawca zostawił ślady dłoni na framudze, ponad dwa metry nad podłogą.","Świadek widział, jak sprawca schyla się w drzwiach, żeby nie uderzyć głową."],
               short:["Świadek widział sprawcę z okna: postać ledwo wystawała zza zaparkowanego Malucha.","Sprawca musiał podstawić sobie skrzynkę, żeby dosięgnąć zasuwki, do której inni sięgają bez trudu."] },
        hint:"Kto nie pasuje wzrostem?",
        why:{ tall:"jest [wysoki|wysoka]", short:"jest [niski|niska]" },
        whyFail:{ tall:"jest [niski|niska]", short:"jest [wysoki|wysoka]" }
      },
      smoker: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Kartka", name:"Kartka z kiosku", icon:"receipt", text:["Kioskarka zapisuje stałym klientom papierosy „na zeszyt”, do pierwszego.","Na kartce z tego tygodnia: «{ini} — trzy paczki Sportów»."] },
                  { label:"Zeszyt", name:"Zeszyt sklepowej", icon:"notebook", text:["Sprzedawczyni ze spożywczego zapisuje długi w zeszycie pod ladą.","Wśród wpisów z tego tygodnia: «{ini}: dwie paczki Klubowych, oddać w piątek»."] }],
        values:["yes","no"], ruleValues:["yes"],
        facts:{ yes:["Pali Sporty, paczkę dziennie.","Palce ma żółte od papierosów.","Na przesłuchaniu [zapalił|zapaliła] dwa papierosy pod rząd.",
                     {t:"Pali Marlboro z przemytu, kupowane na sztuki.", years:[1990,1999]},"W kieszeni nosi pogniecioną paczkę Klubowych.",
                     "Na parapecie ma popielniczkę pełną niedopałków.","Od [jego|jej] płaszcza czuć dym tytoniowy.","[Poprosił|Poprosiła] o przerwę w przesłuchaniu, żeby zapalić."],
                no:["Nie pali od dwudziestu lat.","Nie znosi dymu papierosowego.","Nigdy nie [palił|paliła].",
                    "[Rzucił|Rzuciła] palenie, kiedy sąsiad dostał zawału.","Na przesłuchaniu [poprosił|poprosiła] o otwarcie okna, bo dym [mu|jej] przeszkadza.",
                    "Papierosy kupuje tylko ojcu, [sam|sama] nie pali.","W domu nie ma ani jednej popielniczki."] },
        rule:{ yes:["Na miejscu leżał świeży niedopałek.","W powietrzu jeszcze wisiał świeży dym papierosowy."] },
        hint:"Kto nie pali?",
        why:{ yes:"pali" },
        whyFail:{ yes:"nie pali" }
      },
      car: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Mandat", name:"Mandat za parkowanie", icon:"ticket", text:["Mandat za zostawienie auta na chodniku przy {street2}, wystawiony tydzień temu.","Kierowca przyjął mandat i podpisał się: {ini}."] },
                  { label:"Rachunek", name:"Rachunek z warsztatu", icon:"receipt", text:["Rachunek z warsztatu samochodowego przy {street2}: wymiana tłumika.","Rachunek wystawiono na {ini}. Auto odebrane dzień przed zdarzeniem."] }],
        values:["yes","no"], ruleValues:["yes"],
        facts:{ yes:["Jeździ Polonezem w kolorze kawy z mlekiem.","Ma Malucha zaparkowanego pod blokiem.","Jeździ Żukiem z napisem firmy na burcie.",
                     {t:"Jeździ Golfem sprowadzonym z Niemiec.", years:[1990,1999]},
                     {t:"[Kupił|Kupiła] na raty Cinquecento z Tychów.", years:[1993,1999]},
                     {t:"Jeździ nowiutkim Daewoo Tico.", years:[1997,1999]},"Co niedzielę myje auto pod blokiem.",
                     "Kluczyki do auta nosi na breloku z herbem miasta.","Z balkonu pilnuje swojego samochodu zaparkowanego pod oknem."],
                no:["Nie ma prawa jazdy.","Wszędzie jeździ tramwajem.","Samochód [sprzedał|sprzedała] w zeszłym roku, żeby spłacić długi.",
                    "Na zakupy jeździ autobusem z wózkiem na kółkach.","Nigdy nie [nauczył|nauczyła] się prowadzić i boi się samochodów.",
                    "Na zebraniu spółdzielni [narzekał|narzekała], że samochody zastawiają podwórko, bo [sam|sama] żadnego nie ma."] },
        rule:{ yes:["Świadek widział, jak tuż po zdarzeniu sprawca wsiada do swojego auta i odjeżdża.","Ślady opon na podwórku prowadzą tam, gdzie sprawca zostawił swój samochód."] },
        hint:"Kto nie ma czym odjechać?",
        why:{ yes:"ma samochód" },
        whyFail:{ yes:"nie ma samochodu" }
      },
      glasses: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Recepta", name:"Recepta od okulisty", icon:"receipt", text:["Recepta z przychodni przy {street2}: szkła minus cztery.","Wystawiona dla {ini}. Okulary odebrane u optyka w zeszłym tygodniu."] },
                  { label:"Kwit", name:"Kwit od optyka", icon:"receipt", text:["Kwit z zakładu optycznego: naprawa zausznika w okularach.","Do odbioru w poniedziałek. Zamawiający: {ini}."] }],
        values:["yes","no"], ruleValues:["yes"],
        facts:{ yes:["Bez okularów nie przeczyta gazety.","Nosi grube okulary w rogowej oprawce.","Nosi okulary w cienkiej drucianej oprawce.",
                     "Okulary trzyma na sznurku zawieszonym na szyi.","Na przesłuchaniu co chwilę [przecierał|przecierała] okulary chusteczką.",
                     "Ma szkła grube jak denka od butelek.","Bez okularów nie rozpozna sąsiada po drugiej stronie ulicy.","Okulary [kupił|kupiła] u optyka przy {street2}."],
                no:["Wzrok ma jak sokół, okularów nie nosi.","Okularów nigdy nie [potrzebował|potrzebowała].","Czyta gazetę bez okularów, trzymając ją daleko od oczu.",
                    "Bez trudu czyta rozkład jazdy z drugiej strony ulicy.","U okulisty nie [był|była] od lat, bo nie ma po co.","Z okna wypatrzy listonosza na końcu ulicy."] },
        rule:{ yes:["Szamocząc się, sprawca stłukł szkło w okularach. Odłamek został na podłodze.","Sprawca zgubił na miejscu etui na okulary."] },
        hint:"Kto nie nosi okularów? Spójrz też na zdjęcia.",
        why:{ yes:"nosi okulary" },
        whyFail:{ yes:"nie nosi okularów" }
      },
      dog: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Książeczka", name:"Książeczka szczepień psa", icon:"notebook", text:["Książeczka szczepień psa ze stemplem lecznicy weterynaryjnej.","Pies: kundel, wabi się Burek. Właściciel: {ini}. Ostatnie szczepienie w zeszłym miesiącu."] },
                  { label:"Kwit", name:"Kwit z lecznicy", icon:"receipt", text:["Kwit z lecznicy dla zwierząt przy {street2}: odrobaczanie psa.","Opłatę pobrano od właściciela. Na kwicie: {ini}."] }],
        values:["yes","no"], ruleValues:["yes"],
        facts:{ yes:["Ma kundla, z którym wychodzi trzy razy dziennie.","Na płaszczu ma pełno psiej sierści.","Wieczorami wyprowadza jamnika na podwórko.",
                     "[Jego|Jej] owczarek szczeka na każdego listonosza.","W przedpokoju stoi miska dla psa.","Pies śpi u [niego|niej] w nogach łóżka."],
                no:["Nie ma psa, bo ma alergię na sierść.","Psów boi się od dziecka.","Spółdzielnia nie pozwala [mu|jej] trzymać psa.",
                    "W domu trzyma tylko rybki w akwarium.","Mówi, że na psa nie ma czasu ani pieniędzy.","Na widok psa przechodzi na drugą stronę ulicy."] },
        rule:{ yes:["Na miejscu znaleziono psią sierść, choć nikt tam psa nie trzyma.","Na progu zostały odciski psich łap, a obok ślady sprawcy."] },
        hint:"Kto nie ma psa?",
        why:{ yes:"ma psa" },
        whyFail:{ yes:"nie ma psa" }
      },
      jacket: {
        /* dowód rzeczowy z tą cechą: {ini} = inicjały właściciela, {v} = wartość */
        evidence:[{ label:"Kwit", name:"Kwit z pralni chemicznej", icon:"receipt", text:["Kwit z punktu pralni chemicznej przy {street2}: kurtka z ortalionu do czyszczenia.","Odbiór za tydzień. Na kwicie: {ini}."] },
                  { label:"Bloczek", name:"Bloczek krawcowej", icon:"receipt", text:["Kartka z bloczku krawcowej z sąsiedztwa: wszycie nowego zamka w ortalionowej kurtce.","Zapłacone z góry. Zamawiający: {ini}."] }],
        values:["yes","no"], ruleValues:["yes"],
        facts:{ yes:["Nosi szeleszczącą kurtkę z ortalionu.","Na przesłuchanie [przyszedł|przyszła] w ortalionowym dresie.","Ma ortalionową kurtkę z targu, w trzech kolorach.",
                     "[Jego|Jej] kurtka z ortalionu szeleści przy każdym ruchu.","Na wieszaku w przedpokoju wisi [jego|jej] ortalionowa wiatrówka.","Nie rozstaje się z ortalionową kurtką, nawet w domu."],
                no:["Nosi wełniany płaszcz po ojcu.","Chodzi w kożuchu, choć jest już za ciepło.","Ma tylko jesionkę i gruby sweter.",
                    "Ortalionu nie znosi, mówi, że szeleści jak reklamówka.","Zawsze w marynarce, nawet do sklepu.","Nosi sztruksową kurtkę z łatami na łokciach."] },
        rule:{ yes:["Sprawca zahaczył rękawem o gwóźdź przy drzwiach. Został na nim strzęp ortalionu.","Świadek słyszał w ciemności, jak kurtka sprawcy szeleści ortalionem."] },
        hint:"Kto nie nosi ortalionu?",
        why:{ yes:"nosi ortalion" },
        whyFail:{ yes:"nie nosi ortalionu" }
      },
      motive: {
        /* zdania o motywie są w typie zbrodni: crimes.*.suspicion (tak) i crimes.*.noMotive (nie) */
        values:["yes","no"], ruleValues:["yes"], fromCrime:true,
        hint:"Kto nie miał żadnego powodu?",
        why:{ yes:"[miał|miała] motyw" },
        whyFail:{ yes:"nie [miał|miała] motywu" }
      }
    },

    /* ------------------------------------------------------------------ */
    /* ALIBI                                                                */
    /* ------------------------------------------------------------------ */
    alibiConfirmed: [
      { text:"[grał|grała] w karty w barze „{bar}”", debunk:"Tego wieczoru [przechodził|przechodziła] obok baru „{bar}”. Był zamknięty, w oknach było ciemno.", witness:"potwierdzają to barman i trzech stałych bywalców",
        doc:{ label:"Tabela", name:"Tabela wyników z baru", icon:"card", text:["Barman z „{bar}” zapisuje wyniki partii tysiąca na kartce przypiętej do lady.","Tamtego wieczoru, od {from} do {to}, przy jednym stoliku w każdym rozdaniu zapisano: {ini}."] } },
      { text:"[był|była] na mszy wieczornej {church_at}", debunk:"Mówi, że tego wieczoru mszy {church_at} nie było, bo proboszcz miał pogrzeb za miastem.", witness:"widzieli [go|ją] ksiądz proboszcz i kościelny",
        doc:{ label:"Zeszyt", name:"Zeszyt kościelnego", icon:"notebook", text:["Kościelny {church_at} zapisuje, kto czytał lekcję i kto zbierał na tacę.","Pod datą tamtego dnia, msza od {from} do {to}: na tacę [zbierał|zbierała] {ini}."] } },
      { text:"[oglądał|oglądała] mecz {team} u szwagra", debunk:"Wie z radia, że mecz {team} tego dnia przełożono, bo boisko zalało.", witness:"potwierdzają to szwagier i jego żona" },
      { text:"[pracował|pracowała] na drugiej zmianie {zaklad_at}", debunk:"[Słyszał|Słyszała] w kolejce, że druga zmiana {zaklad_at} miała tego dnia wolne, bo stanęła produkcja.", witness:"potwierdza to brygadzista i lista obecności",
        doc:{ label:"Karta", name:"Karta zegarowa", icon:"card", text:["Karta zegarowa z portierni {zaklad_at}.","Odbita przy wejściu o {from} i przy wyjściu o {to}. Nazwisko zatarte, czytelne tylko inicjały: {ini}."] } },
      { text:"[siedział|siedziała] na zebraniu spółdzielni mieszkaniowej", debunk:"Mówi, że zebranie spółdzielni odwołano w ostatniej chwili, bo nie przyszedł prezes.", witness:"[jego|jej] podpis widnieje w protokole zebrania",
        doc:{ label:"Lista", name:"Lista obecności z zebrania", icon:"card", text:["Lista obecności z zebrania spółdzielni mieszkaniowej, z pieczątką prezesa.","Zebranie trwało od {from} do {to}. Podpis {ini} jest i przy wejściu, i przy głosowaniu na końcu."] } },
      { text:"[stał|stała] w kolejce do kasy na {dworzec}", debunk:"[Był|Była] tego wieczoru na {dworzec}. Kasy były zamknięte, bo kasjerka zachorowała.", witness:"potwierdza to kasjerka, która [go|ją] zapamiętała" },
      { text:"[był|była] na imieninach u sąsiadki z naprzeciwka", witness:"potwierdzają to solenizantka i dziesięciu gości",
        doc:{ label:"Zdjęcia", name:"Zdjęcia z imienin", icon:"photo", text:["Odbitki z imienin u sąsiadki z naprzeciwka, robione Zenitem przez cały wieczór.","Na odwrocie solenizantka zapisała godziny, od {from} do {to}, i kto siedzi przy stole. Na każdym zdjęciu: {ini}."] } },
      { text:"[siedział|siedziała] w poczekalni pogotowia z sąsiadem", witness:"potwierdza to rejestratorka i wpis w książce przyjęć",
        doc:{ label:"Wpis", name:"Odpis z książki przyjęć", icon:"notebook", text:["Odpis z książki przyjęć pogotowia, z pieczątką rejestracji.","Sąsiad przyjęty o {from}, wypisany o {to}. Osoba towarzysząca, cały czas w poczekalni: {ini}."] } },
      { text:"[był|była] w kinie „{cinema}” na ostatnim seansie", debunk:"Wie od bileterki, że ostatni seans w kinie „{cinema}” odwołano, bo zerwała się taśma.", witness:"bileterka [go|ją] pamięta, a bilet ma w kieszeni",
        doc:{ label:"Bilet", name:"Bilet z kina", icon:"ticket", text:["Bilet na ostatni seans w kinie „{cinema}”, oddarty przez bileterkę.","Seans od {from} do {to}. Bileterka zapisuje stałym widzom miejsca w zeszycie: rząd siódmy, {ini}."] } }
    ],
    alibiClaim: [
      "od {from} [spał|spała]","cały wieczór [oglądał|oglądała] telewizję w domu","[poszedł|poszła] na spacer {walk}",
      "[siedział|siedziała] u siebie i [czytał|czytała] gazetę „{gazeta}”","[chodził|chodziła] {district_po}, żeby się przewietrzyć",
      "[był|była] w piwnicy, szukając przetworów","[słuchał|słuchała] Trójki w kuchni",
      {t:"[oglądał|oglądała] w domu „Dynastię”", years:[1990,1992]},
      {t:"[oglądał|oglądała] „Koło Fortuny” u siebie w pokoju", years:[1992,1998]},
      {t:"[oglądał|oglądała] w kuchni „Klan”", years:[1997,1999]},
      {t:"[oglądał|oglądała] u siebie film z wypożyczalni", years:[1990,1999]}
    ],

    /* Ramy dla niepotwierdzonego alibi; {x} = treść z alibiClaim */
    claimFrame: [
      "Twierdzi, że {x}. Nikt tego nie potwierdza.","Mówi, że {x}, ale nie ma na to świadków.","Zeznaje, że {x}. Świadków brak.",
      "Upiera się, że {x}. Nikt [go|jej] wtedy nie widział.","Według [niego|niej] {x}. Sąsiedzi niczego takiego nie pamiętają."
    ],
    /* Klucze: rola, która ma klucz z urzędu, i ktoś z zapasowym */
    keyTpl: ["Ma klucz do {gen}.","Nosi przy sobie klucz do {gen}.","Klucz do {gen} wisi u [niego|niej] na gwoździu w przedpokoju.","[Dostał|Dostała] klucz do {gen} razem z pracą."],
    spareKeyTpl: ["Ma zapasowy klucz do {gen}, [dostał|dostała] go od właściciela.","Właściciel zostawił [mu|jej] zapasowy klucz do {gen}.",
                  "Od lat ma dorobiony klucz do {gen}.","Pożyczony klucz do {gen} [zapomniał|zapomniała] oddać."],

    /* ------------------------------------------------------------------ */
    /* DOWODY RZECZOWE (etap 1)                                             */
    /* Dowód zabiera z teczki jeden fakt. Właściciela wskazuje znak:        */
    /* {ini} = inicjały, {flat} = numer mieszkania (jest w teczce każdego). */
    /* ------------------------------------------------------------------ */
    evidence: {
      /* obecność w miejscu o godzinie: {t}, {in} */
      presence: [
        { label:"Zeszyt", name:"Zeszyt dozorcy", icon:"notebook", text:["Dozorca zapisuje w zeszycie w kratkę, kto o której kręci się po podwórku.","Wpis z tamtego wieczoru: «{t} — {ini}, {in}»."] },
        { label:"Notes", name:"Notes sąsiadki z parteru", icon:"notebook", text:["Sąsiadka z parteru notuje „na wszelki wypadek”, kto chodzi koło jej okien.","Pod datą tamtego dnia, drobnym pismem: «{t}. {ini} {in}.»"] },
        { label:"Raport", name:"Raport stróża nocnego", icon:"card", text:["Stróż z osiedla co wieczór obchodzi podwórka i spisuje raport dla administracji.","W raporcie: «Godz. {t}. Spotkano {ini} {in}. Bez uwag.»"] },
        { label:"Bloczek", name:"Kartka z dyżurki", icon:"receipt", text:["Kartka z bloczku, znaleziona w dyżurce obok telefonu. Dyżurny notuje na niej, kogo minął na obchodzie.","Długopisem, krzywo: «{t} — {ini}, {in}»."] }
      ],
      /* klucz: {gen}, {flat}; tylko miejsca z keyBookLocs */
      keys: [
        { label:"Książka", name:"Książka wydań kluczy", icon:"keybook", text:["Dozorca wydaje klucze wyłącznie za wpisem do książki.","Wpis sprzed miesiąca: klucz do {gen} wydany na stałe lokatorowi spod {flat}. Do dziś nie zwrócony."] },
        { label:"Tablica", name:"Tablica z kluczami w dyżurce", icon:"keybook", text:["W dyżurce wisi deska z haczykami podpisanymi numerami mieszkań.","Haczyk z kluczem do {gen} jest pusty. Pod spodem ołówkiem: «u m. {flat}»."] },
        { label:"Rewers", name:"Rewers od ślusarza", icon:"receipt", text:["Rewers z zakładu ślusarskiego przy {street2}: dorobienie klucza do {gen}.","Odbiór potwierdzony. Zamawiający: lokator spod {flat}."] }
      ]
    },
    keyBookLocs: ["piwnica", "pralnia", "kotlownia", "garaz", "warsztat"],
    /* zdanie w aktach miejsca, gdy jeden z kluczy jest tylko na dowodzie */
    keyBookNote: { others: "Jeszcze jeden klucz wydano po numerze mieszkania, bez nazwiska.", only: "Klucz wydano tylko po numerze mieszkania, bez nazwiska." },
    /* numer mieszkania w teczce (gdy w sprawie jest dowód z numerem) */
    flatTpl: [
      "Mieszka w kamienicy przy {street}, w mieszkaniu nr {flat}.","Od lat zajmuje mieszkanie nr {flat} przy {street}.",
      "Na drzwiach [jego|jej] mieszkania wisi mosiężny numer {flat}.","W dowodzie osobistym ma wpisane mieszkanie nr {flat} przy {street}.",
      "W spisie lokatorów na klatce figuruje pod numerem {flat}.","Płaci czynsz za mieszkanie nr {flat}, choć często z opóźnieniem.",
      "Mieszka pod {flat}, na ostatnim piętrze, bez windy."
    ],
    /* teczka osoby, której alibi potwierdza dopiero dowód; {x} = treść alibi */
    alibiPaperTpl: [
      "Od {from} do {to} {x}. Świadków nie podaje, mówi, że wszystko jest na papierze.","Twierdzi, że od {from} do {to} {x}. Każe to sprawdzić w papierach.",
      "Zeznaje, że od {from} do {to} {x}. Mówi, że ktoś musiał to zapisać.","Od {from} do {to} podobno {x}. O świadków każe pytać w papierach.",
      "Według [niego|niej] od {from} do {to} {x}. „Jest gdzieś kwit”, mówi."
    ],

    /* Kto widział kogoś w danym miejscu */
    presenceTpl: [
      "Sąsiad widział [go|ją] {in} o {t}.","[Sam|Sama] przyznaje, że o {t} [był|była] {in}.",
      "Około {t} [był|była] {in}. Widziały [go|ją] dzieci grające w kapsle.","Listonosz minął [go|ją] {in} o {t}.",
      "Dozorca zapisał w zeszycie, że o {t} [był|była] {in}.","O {t} [rozmawiał|rozmawiała] z kimś {in}, jak mówi sąsiadka z okna.","Kioskarz z naprzeciwka widział [go|ją] {in} około {t}."
    ],

    /* Realia epoki: smaczki z zakresem lat */
    eraFlavor: [
      {t:"Trzyma w szufladzie bony towarowe Pewexu, choć coraz trudniej je wydać.", years:[1989,1990]},
      {t:"Wozi towar na handel do Berlina Zachodniego.", years:[1989,1989]},
      {t:"Liczy ceny w milionach i ciągle myli się przy kasie.", years:[1990,1994]},
      {t:"Nie może się przyzwyczaić do nowych złotówek po denominacji.", years:[1995,1996]},
      {t:"Słucha disco polo z kaset kupionych na targu.", years:[1993,1998]},
      {t:"Chwali się telefonem komórkowym wielkości cegły.", years:[1996,1999]},
      {t:"Nosi przy pasku pager i co chwilę na niego zerka.", years:[1995,1999]},
      {t:"Na balkonie ma antenę satelitarną i ogląda niemieckie programy.", years:[1990,1999]},
      {t:"[Kupił|Kupiła] na raty magnetowid i nagrywa filmy z Polsatu.", years:[1993,1999]},
      {t:"Planuje wyjazd na saksy do Niemiec.", years:[1989,1999]},
      {t:"W każdą środę i sobotę skreśla liczby w totku.", years:[1989,1999]},
      {t:"Ma w domu komputer Atari i gra na nim po nocach.", years:[1989,1994]},
      {t:"Ma w domu pegazusa i gra w „Contrę” z synem sąsiadów.", years:[1992,1999]}
    ],

    /* Komentarze komisarza na koniec sprawy */
    quips: [
      "Dobra robota. Tu nic się nie dzieje bez świadka.",
      "Myślałem, że tę sprawę zamkniemy dopiero po świętach.",
      "Kawa się zagotowała, a sprawa rozwiązana. Dobry dzień.",
      "{district_na_cap} znowu będzie o czym plotkować.",
      "Zapiszę to w raporcie jako wzorcową robotę śledczą."
    ],

    /* ------------------------------------------------------------------ */
    /* TYPY ZBRODNI I SCENY                                                 */
    /* Sceny: vg = płeć ofiary, {victim} = generowane imię i nazwisko.     */
    /* ------------------------------------------------------------------ */
    crimes: {
      zabojstwo: {
        /* dowody rzeczowe z motywem (cecha motive = yes); {ini} = inicjały autora */
        letters:[{ label:"List", name:"List bez znaczka", icon:"letter", text:["List w kopercie bez znaczka, znaleziony w szufladzie ofiary.","«Oddaj, co jesteś mi winien, bo pożałujesz. Nie żartuję.» Podpis: {ini}."] },
                 { label:"Kartka", name:"Kartka spod drzwi", icon:"letter", text:["Kartka w kratkę, wsunięta ofierze pod drzwi kilka dni przed śmiercią.","«Wiem, kto na mnie doniósł w osiemdziesiątym pierwszym. Policzymy się.» Podpis: {ini}."] },
                 { label:"Pocztówka", name:"Pocztówka z groźbą", icon:"letter", text:["Pocztówka z Kołobrzegu, bez znaczka, wrzucona ofierze do skrzynki.","Na odwrocie: «Mieszkanie po ciotce należy się mnie. Wyprowadź się po dobroci.» Podpis: {ini}."] }],
        name:"Zabójstwo", subtags:["tepe","ostre","sznur"], toolLabel:"Narzędzie zbrodni",
        cause:{ tepe:"[Zginął|Zginęła] od ciosu ciężkim przedmiotem.", ostre:"[Zginął|Zginęła] od rany zadanej ostrym narzędziem.", sznur:"[Został uduszony|Została uduszona] sznurem." },
        itemsSentence:"Tego wieczoru z okolicy zniknęły przedmioty, którymi można było to zrobić.",
        alibiEvent:"Zgon nastąpił",
        windowRule:["Nikt nie podał sprawcy narzędzia zbrodni. Sprawca wziął je sam, prosto z miejsca, w którym leżało.", "Narzędzie zbrodni nie przechodziło z rąk do rąk. Zabrał je osobiście sam sprawca.", "Narzędzie zbrodni zabrała ta sama osoba, która potem zadała cios."],
        keyRule:["Tam, skąd zniknęło narzędzie zbrodni, drzwi były zamknięte, a śladów włamania nie ma.", "Narzędzie zbrodni wzięto zza zamkniętych drzwi, a zamek jest nietknięty.", "Drzwi tam, skąd zniknęło narzędzie zbrodni, otwarto kluczem, nie wytrychem."],
        motives:["[był winien|była winna] ofierze {money} i [bał|bała] się, że sprawa wyjdzie na jaw",
                 "od lat nie [mógł|mogła] darować ofierze donosu z dawnych lat",
                 "[chciał|chciała] przejąć lokal po ofierze, a ta nie zamierzała się wyprowadzać",
                 "[dowiedział|dowiedziała] się, że ofiara chce [go|ją] wydać {police_dat} za handel na lewo"],
        suspicion:["[Pokłócił|Pokłóciła] się z ofiarą tydzień temu na klatce schodowej.","[Był winien|Była winna] ofierze {money}.","[Odgrażał|Odgrażała] się ofierze przy świadkach.","Sąsiadka słyszała, jak [kłócił|kłóciła] się z ofiarą o pieniądze.","Od lat nie [rozmawiał|rozmawiała] z ofiarą po kłótni o spadek.","Ofiara publicznie [go|ją] oskarżyła o kradzież.","Ofiara groziła, że doniesie na [niego|nią] do urzędu skarbowego."],
        noMotive:["Ofiarę [znał|znała] tylko z widzenia.", "Z ofiarą [mówił|mówiła] sobie tylko „dzień dobry”.", "[Nie miał|Nie miała] z ofiarą żadnych interesów.", "Ofiara pożyczała [mu|jej] cukier i nigdy się nie kłócili.", "O śmierci ofiary [dowiedział|dowiedziała] się z gazety.", "Twierdzi, że ofiara była dla [niego|niej] zawsze miła."],
        motiveRule:["To nie był przypadek ani napad rabunkowy. Ktoś chciał, żeby zginęła właśnie ta osoba.", "Nic nie zginęło, niczego nie przeszukano. Sprawcy chodziło tylko o ofiarę."],
        alibiRule:["{ev} między {a} a {b}. Sprawca nie ma potwierdzonego alibi na ten czas.", "Lekarz ustalił czas: między {a} a {b}. Nikt nie potwierdza, gdzie sprawca był w te pół godziny.", "Wszystko rozegrało się między {a} a {b}. Kto ma na tę porę świadków, nie jest sprawcą."],
        epilogueEnd:"i [poszedł|poszła] prosto {to}.",
        scenes:[
          { title:"Zegarmistrz z {street}", vg:"m", to:"do pracowni", where:"w pracowni",
            intro:"Zegarmistrz {victim} zostaje znaleziony martwy w swojej pracowni przy {street}." },
          { title:"Szewc z {street}", vg:"m", to:"do zakładu szewskiego", where:"w zakładzie szewskim",
            intro:"Szewc {victim} zostaje znaleziony martwy w swoim zakładzie przy {street}." },
          { title:"Kantor przy {street}", vg:"m", to:"do kantoru", where:"w kantorze",
            intro:"{victim}, właściciel kantoru przy {street}, zostaje znaleziony martwy za ladą." },
          { title:"Wdowa z {street}", vg:"f", vage:"old", to:"na trzecie piętro", where:"w mieszkaniu",
            intro:"Emerytowana nauczycielka {victim} zostaje znaleziona martwa w mieszkaniu przy {street}." },
          { title:"Wypożyczalnia przy {street}", vg:"m", to:"do wypożyczalni", where:"w wypożyczalni", years:[1990,1999],
            intro:"{victim}, właściciel wypożyczalni kaset wideo przy {street}, zostaje znaleziony martwy między regałami." },
          { title:"Krawcowa z {street}", vg:"f", to:"do pracowni krawieckiej", where:"w pracowni",
            intro:"Krawcowa {victim} zostaje znaleziona martwa w swojej pracowni przy {street}." }
        ]
      },
      kradziez: {
        /* dowody rzeczowe z motywem (cecha motive = yes); {ini} = inicjały autora */
        letters:[{ label:"Wezwanie", name:"Wezwanie do zapłaty", icon:"letter", text:["Wezwanie od komornika, z pieczątką sądu rejonowego.","Termin spłaty minął tydzień temu, kwota {money}. Dłużnik: {ini}."] },
                 { label:"Notes", name:"Notes karciarza", icon:"notebook", text:["Notes karciarza z baru „{bar}”, z rachunkiem przegranych.","Na ostatniej stronie: «{ini} winien {money}, termin w sobotę»."] },
                 { label:"Kartka", name:"Kartka z długami", icon:"letter", text:["Kartka wyrwana z kalendarza, znaleziona na klatce schodowej.","Lista pożyczek: od dozorcy, od sąsiadów z trzeciego, od szwagra. Razem {money}. Podpis: {ini}."] }],
        name:"Kradzież", subtags:["wlam"], toolLabel:"Narzędzie włamania",
        cause:{ wlam:"Drzwi podważono czymś ciężkim i płaskim." },
        itemsSentence:"Tego wieczoru z okolicy zniknęły przedmioty, którymi dało się to zrobić.",
        alibiEvent:"Do włamania doszło",
        windowRule:["Nikt nie podał złodziejowi narzędzia włamania. Wziął je sam, prosto z miejsca, w którym leżało.", "Narzędzie włamania nie przechodziło z rąk do rąk. Złodziej zabrał je osobiście.", "Złodziej sam przyniósł sobie narzędzie, prosto z miejsca, gdzie leżało."],
        keyRule:["Tam, skąd zniknęło narzędzie włamania, drzwi były zamknięte, a śladów włamania nie ma.", "Narzędzie wzięto z zamkniętego pomieszczenia, a zamek jest cały.", "Po narzędzie złodziej nie musiał się włamywać. Drzwi, za którymi leżało, otwarto kluczem."],
        motives:["[potrzebował|potrzebowała] pieniędzy na spłatę długu u lichwiarza","[przegrał|przegrała] w karty {money}",
                 "[chciał|chciała] wyjechać na saksy do Niemiec i [brakowało mu|brakowało jej] na bilet","od miesięcy [zalegał|zalegała] z czynszem"],
        suspicion:["Ostatnio [chodził|chodziła] po sąsiadach, pożyczając pieniądze.", "Widziano [go|ją], jak [zaglądał|zaglądała] w okno poszkodowanych.", "Ma długi w całej dzielnicy.", "Ostatnio [przegrał|przegrała] w karty więcej, niż [miał|miała].", "Komornik był u [niego|niej] w zeszłym miesiącu.", "[Pytał|Pytała] sąsiadów, kiedy poszkodowani wyjeżdżają na działkę."],
        noMotive:["Ma stałą pracę i nie narzeka na brak pieniędzy.", "Niedawno [odziedziczył|odziedziczyła] mieszkanie i nie potrzebuje pieniędzy.", "Nie ma żadnych długów, za wszystko płaci gotówką.", "Poszkodowanych [znał|znała] tylko z widzenia.", "To [on|ona] [pożyczył|pożyczyła] poszkodowanym pieniądze, a nie odwrotnie.", "Odkłada na książeczkę co miesiąc i nikomu nic nie jest [winien|winna]."],
        motiveRule:["To nie była przypadkowa kradzież. Złodziej miał powód, żeby sięgnąć właśnie po te pieniądze.", "Ktoś tu działał z wyrachowania: tonął w długach albo od dawna miał ten łup na oku."],
        alibiRule:["{ev} między {a} a {b}. Sprawca nie ma potwierdzonego alibi na ten czas.", "Sąsiedzi słyszeli trzask drzwi między {a} a {b}. Sprawca nie ma alibi na ten czas.", "Wszystko rozegrało się między {a} a {b}. Kto ma na tę porę świadków, nie jest sprawcą."],
        epilogueEnd:"i [poszedł|poszła] prosto {to}.",
        scenes:[
          { title:"Utarg {market_from}", vg:"m", to:"{market_to}", where:"przy budce",
            intro:"Z jednej z budek {market_on} zniknął cały tygodniowy utarg." },
          { title:"Magnetowid z {street}", vg:"m", to:"pod drzwi poszkodowanych", where:"przy drzwiach", years:[1989,1999],
            intro:"Z mieszkania przy {street} zniknął nowiutki magnetowid, kupiony za oszczędności całej rodziny." },
          { title:"Puszka po herbacie", vg:"f", vage:"old", to:"do mieszkania emerytki", where:"przy drzwiach",
            intro:"Emerytce z {street} zginęły oszczędności schowane w puszce po herbacie." },
          { title:"Kasa kina „{cinema}”", vg:"m", to:"do kina", where:"przy kasie",
            intro:"Z kasy kina „{cinema}” zniknęły wpływy z całego weekendu." },
          { title:"Kantor przy {street}", vg:"m", to:"do kantoru", where:"przy kasie pancernej",
            intro:"Z kantoru przy {street} zniknęły dolary i marki z całego tygodnia." }
        ]
      },
      otrucie: {
        /* dowody rzeczowe z motywem (cecha motive = yes); {ini} = inicjały autora */
        letters:[{ label:"Skarga", name:"Skarga do administracji", icon:"letter", text:["Skarga złożona w administracji osiedla, z pieczątką wpływu.","«Zwierzęta z podwórka nie dają spać całej klatce. Jak administracja nic nie zrobi, zrobię to [sam|sama].» Podpis: {ini}."] },
                 { label:"Ogłoszenie", name:"Ogłoszenie z klatki", icon:"letter", text:["Kartka zerwana z tablicy ogłoszeń na klatce schodowej.","«Kto trzyma zwierzęta w bloku, niech się z nimi wyprowadzi. Inaczej pożałuje.» Podpis: {ini}."] },
                 { label:"Protokół", name:"Protokół zebrania lokatorów", icon:"card", text:["Protokół z zebrania lokatorów, przepisany na maszynie.","Punkt trzeci: wniosek o usunięcie zwierząt z budynku. Wniosek przepadł. Wnioskodawca: {ini}."] }],
        name:"Otrucie", subtags:["trucizna"], toolLabel:"Trucizna",
        cause:{ trucizna:"Weterynarz nie ma wątpliwości, że to trucizna." },
        itemsSentence:"Tego wieczoru z okolicy zniknęły substancje, które mogły do tego posłużyć.",
        alibiEvent:"Truciznę podano",
        windowRule:["Nikt nie podał sprawcy trucizny. Sprawca wziął ją sam, prosto z miejsca, w którym leżała.", "Trucizna nie przechodziła z rąk do rąk. Zabrał ją osobiście sam sprawca.", "Truciznę zabrała ta sama osoba, która ją podała."],
        keyRule:["Tam, skąd zniknęła trucizna, drzwi były zamknięte, a śladów włamania nie ma.", "Truciznę wzięto z zamkniętego pomieszczenia, a zamek jest cały.", "Drzwi tam, skąd zniknęła trucizna, otwarto kluczem, nie wytrychem."],
        motives:["nie [mógł|mogła] znieść hałasu o piątej rano","od miesięcy [kłócił|kłóciła] się z właścicielem o podwórko",
                 "[uważał|uważała], że to przez zwierzęta zgniły [mu|jej] pomidory","[chciał|chciała] się zemścić za skargę do administracji"],
        suspicion:["[Pisał|Pisała] skargi do administracji na hałas.", "[Groził|Groziła], że „zrobi z tym porządek”.", "[Pokłócił|Pokłóciła] się z właścicielem zwierząt na podwórku.", "Na zebraniu lokatorów [domagał|domagała] się, żeby zwierzęta zniknęły z podwórka.", "[Narzekał|Narzekała] u dozorcy, że zwierzęta nie dają [mu|jej] spać.", "Wylewa wodę z okna, gdy zwierzęta podchodzą pod blok."],
        noMotive:["Dokarmia ptaki na parapecie i kocha zwierzęta.", "Nigdy nie [skarżył|skarżyła] się na hałas z podwórka.", "Zwierzęta z podwórka zna po imieniu i przynosi im resztki.", "Mówi, że hałas [mu|jej] nie przeszkadza, bo śpi jak kamień.", "Z właścicielem zwierząt [chodził|chodziła] do jednej klasy i do dziś się przyjaźnią.", "O sprawie [dowiedział|dowiedziała] się od dozorcy i [był oburzony|była oburzona]."],
        motiveRule:["Trucizny nie podano przypadkiem. Ktoś od dawna miał dość tych zwierząt.", "Ktoś chciał się pozbyć zwierząt i nie krył się z tym przed sąsiadami."],
        alibiRule:["{ev} między {a} a {b}. Sprawca nie ma potwierdzonego alibi na ten czas.", "Weterynarz mówi, że truciznę podano między {a} a {b}. Nikt nie potwierdza, gdzie sprawca był w tym czasie.", "Wszystko rozegrało się między {a} a {b}. Kto ma na tę porę świadków, nie jest sprawcą."],
        epilogueEnd:"i [poszedł|poszła] prosto {to}.",
        scenes:[
          { title:"Gołębie z {street}", vg:"m", to:"na dach, do gołębnika", where:"w gołębniku",
            intro:"Ktoś otruł gołębie pocztowe w gołębniku na dachu kamienicy przy {street}." },
          { title:"Jamnik z {street}", vg:"f", to:"na podwórko", where:"przy misce",
            intro:"Ktoś podał truciznę jamnikowi sąsiadki z {street}. Pies na szczęście przeżył." },
          { title:"Akwarium inżyniera", vg:"m", to:"do mieszkania inżyniera", where:"przy akwarium",
            intro:"Inżynier z {street} znalazł wszystkie rybki w akwarium martwe." },
          { title:"Kot z {street}", vg:"f", to:"na podwórko", where:"przy misce",
            intro:"Ktoś otruł kota, którego dokarmiała połowa kamienicy przy {street}. Kot przeżył dzięki weterynarzowi." }
        ]
      },
      podpalenie: {
        /* dowody rzeczowe z motywem (cecha motive = yes); {ini} = inicjały autora */
        letters:[{ label:"List", name:"List do właściciela", icon:"letter", text:["List znaleziony w skrzynce pocztowej właściciela, tydzień przed pożarem.","«Wyrzuciłeś mnie jak psa. Jeszcze zobaczysz, co zostanie z twojego interesu.» Podpis: {ini}."] },
                 { label:"Podanie", name:"Podanie do urzędu dzielnicy", icon:"card", text:["Podanie do urzędu dzielnicy o przydział tego samego miejsca.","Odpowiedź odmowna, z dopiskiem „miejsce zajęte”. Wnioskodawca: {ini}."] },
                 { label:"Kartka", name:"Kartka na drzwiach", icon:"letter", text:["Kartka przyklejona taśmą do drzwi właściciela.","«To miejsce szpeci całą ulicę. Już niedługo.» Podpis: {ini}."] }],
        name:"Podpalenie", subtags:["ogien"], toolLabel:"Środek zapalający",
        cause:{ ogien:"Strażacy mówią, że ktoś pomógł ogniu się rozpalić." },
        itemsSentence:"Tego wieczoru z okolicy zniknęły przedmioty, którymi można było to zrobić.",
        alibiEvent:"Ogień podłożono",
        windowRule:["Nikt nie podał podpalaczowi środka zapalającego. Wziął go sam, prosto z miejsca, w którym leżał.", "Środek zapalający nie przechodził z rąk do rąk. Podpalacz zabrał go osobiście.", "Podpalacz sam przyniósł to, czym rozpalił ogień, prosto z miejsca, gdzie to leżało."],
        keyRule:["Tam, skąd zniknął środek zapalający, drzwi były zamknięte, a śladów włamania nie ma.", "Środek zapalający wzięto z zamkniętego pomieszczenia, a zamek jest cały.", "Drzwi tam, skąd zniknął środek zapalający, otwarto kluczem, nie wytrychem."],
        motives:["[chciał|chciała] wyłudzić odszkodowanie od ubezpieczyciela","od dawna [był skłócony|była skłócona] z właścicielem",
                 "[chciał|chciała] przejąć to miejsce pod własny interes","[mścił|mściła] się za zwolnienie z pracy"],
        suspicion:["[Kłócił|Kłóciła] się z właścicielem o miejsce na podwórku.", "Widziano [go|ją], jak [kręcił|kręciła] się tam po zmroku.", "[Mówił|Mówiła] głośno, że „to wszystko powinno spłonąć”.", "Właściciel zwolnił [go|ją] z pracy miesiąc temu.", "[Chciał|Chciała] postawić w tym miejscu własną budkę.", "Od dawna [skarżył|skarżyła] się, że to miejsce szpeci okolicę."],
        noMotive:["Z właścicielem żyje w zgodzie od lat.", "W pożarze [stracił|straciła] własny rower.", "[Pomagał|Pomagała] gasić ogień, aż przyjechała straż.", "[Nie miał|Nie miała] z właścicielem żadnych zatargów.", "Mówi, że to miejsce było [mu|jej] zupełnie obojętne.", "Właściciel jest [jego|jej] chrzestnym."],
        motiveRule:["Ogień podłożył ktoś, kto miał porachunki z właścicielem.", "To nie było zaprószenie ognia. Ktoś chciał się zemścić albo na tym pożarze zarobić."],
        alibiRule:["{ev} między {a} a {b}. Sprawca nie ma potwierdzonego alibi na ten czas.", "Strażacy ustalili, że ogień zaprószono między {a} a {b}. Sprawca nie ma alibi na ten czas.", "Wszystko rozegrało się między {a} a {b}. Kto ma na tę porę świadków, nie jest sprawcą."],
        epilogueEnd:"i [poszedł|poszła] prosto {to}.",
        scenes:[
          { title:"Szopa z rowerami", vg:"m", to:"na podwórko przy {street}", where:"przy szopie",
            intro:"Spłonęła drewniana szopa na rowery na podwórku przy {street}." },
          { title:"Budka z warzywami", vg:"m", to:"{market_to}", where:"przy budce",
            intro:"W nocy spłonęła budka z warzywami {market_on}." },
          { title:"Altana prezesa", vg:"m", to:"na ogródki działkowe", where:"przy altanie", exclude:["dzialka"],
            intro:"Spłonęła altana prezesa ogródków działkowych." },
          { title:"Wiata przy {street}", vg:"m", to:"na przystanek", where:"przy wiacie", exclude:["kiosk"],
            intro:"Ktoś podpalił wiatę przystanku tramwajowego przy {street}." },
          { title:"Szczęka z ciuchami", vg:"f", to:"{market_to}", where:"przy szczęce", years:[1990,1999],
            intro:"W nocy spłonęła blaszana szczęka z ciuchami {market_on}." }
        ]
      }
    }
  };

  root.SIATKA_BASE = BASE;
  if (typeof module !== "undefined" && module.exports) module.exports = BASE;
})(typeof window !== "undefined" ? window : globalThis);
