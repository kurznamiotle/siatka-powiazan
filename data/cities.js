/*
 * Siatka Powiązań — paczki miast (lata 1989–1999).
 *
 * Każde miasto daje: dzielnicę (z formami gramatycznymi), ulice w dopełniaczu
 * („z Ząbkowskiej”, „przy Ząbkowskiej”), targ, bary, kościół, kino, gazetę,
 * dworzec, drużynę, zakład pracy, uczelnię, własne role i smaczki.
 * Pola mogą być tekstem albo listą {t, years} — wtedy generator bierze wariant z danego roku.
 *
 * Nowe miasto = nowy wpis o tej samej strukturze.
 */
(function (root) {
  const CITIES = {
    warszawa: {
      name:"Warszawa",
      district:{ nom:"Praga", gen:"Pragi", na:"na Pradze", po:"po Pradze" },
      streets:["Ząbkowskiej","Brzeskiej","Targowej","Stalowej","Kawęczyńskiej","Okrzei","Wileńskiej","Inżynierskiej","Środkowej","Konopackiej"],
      market:{ on:"na bazarze Różyckiego", from:"z bazaru Różyckiego", to:"na bazar Różyckiego" },
      bars:["Pod Kogutem","Na Rogu","Pod Kasztanem"],
      church_at:"u św. Floriana", teams:["Legii","Polonii"], cinema:"Praha", gazeta:"Express Wieczorny",
      dworzec:"Dworcu Wileńskim", szpital:"szpitalu praskim", walk:"nad Wisłę", uni:"Politechniki",
      zaklad_at:"w FSO na Żeraniu",
      worker:{ id:"worker", age:["young","mid"], m:"Robotnik z FSO", f:"Robotnica z FSO", access:[],
        outfit:{shape:"plain",c:"#4d5a44",d:"#7f8c6e"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Od dwudziestu lat skręca Polonezy na Żeraniu.","Boi się zwolnień, o których mówią w zakładzie."] },
      locations:[
        { id:"szczeka", name:"Szczęka na bazarze Różyckiego", label:"Szczęka", gen:"szczęki", in:"w szczęce na bazarze", from:"ze szczęki na bazarze", icon:"stall", roles:["handlarz","prywaciarz","praski"],
          open:["Na bazarze w ciągu dnia każdy kręci się przy cudzych budkach.", "Plandekę z tyłu budki można po prostu odchylić."],
          desc:["Blaszana budka z pyzami w słoikach i kapustą na wagę.","Między budkami pachnie flakami i tanimi perfumami."] },
        { id:"przystan", name:"Przystań nad Wisłą", label:"Przystań", gen:"przystani", in:"na przystani", from:"z przystani", icon:"pier", roles:[],
          open:["Szopa z łodziami zamyka się na sznurek.", "Na pomost i do szopy wejdzie każdy, kto przyjdzie od strony wału."],
          desc:["Drewniany pomost i szopa na łodzie, z widokiem na Stare Miasto.","Łodzie wioślarzy leżą do góry dnem na stojakach."] }
      ],
      roles:[
        { id:"praski", age:["young","mid"], m:"Bazarowy cwaniak", f:null, access:[], outfit:{shape:"jacket",c:"#59493b",d:"#c9b98f"}, headwear:{m:["kaszkiet"]},
          flavor:["Na bazarze załatwi wszystko, od części do Poloneza po bilety na Legię."] }
      ],
      flavor:["Mówi praską gwarą, jak z piosenek Grzesiuka.","Mówi, że przez most na lewy brzeg chodzi tylko w ważnych sprawach.",
              "Pamięta, jak w kamienicy był jeden telefon na całą klatkę."],
      quips:["Na Pradze nic się nie dzieje bez świadka."]
    },

    poznan: {
      name:"Poznań",
      district:{ nom:"Jeżyce", gen:"Jeżyc", na:"na Jeżycach", po:"po Jeżycach" },
      streets:["Dąbrowskiego","Kraszewskiego","Słowackiego","Szamarzewskiego","Prusa","Jackowskiego","Żeromskiego","Kościelnej","Poznańskiej","Mylnej"],
      market:{ on:"na Rynku Jeżyckim", from:"z Rynku Jeżyckiego", to:"na Rynek Jeżycki" },
      bars:["Pod Koziołkami","U Pyrki","Pod Arkadami"],
      church_at:"w farze", teams:["Lecha","Warty"], cinema:"Muza", gazeta:"Głos Wielkopolski",
      dworzec:"Dworcu Głównym", szpital:"szpitalu miejskim", walk:"nad Wartę", uni:"UAM",
      zaklad_at:"w zakładach Cegielskiego",
      worker:{ id:"worker", age:["young","mid"], m:"Robotnik z Cegielskiego", f:"Robotnica z Cegielskiego", access:[],
        outfit:{shape:"plain",c:"#2f4f6f",d:"#5b7a99"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Pracuje przy silnikach okrętowych u Cegielskiego.","Po szychcie zawsze kupuje gazetę w tym samym kiosku."] },
      locations:[
        { id:"piekarnia", name:"Piekarnia na Jeżycach", label:"Piekarnia", gen:"piekarni", in:"w piekarni", from:"z piekarni", icon:"shop", roles:["piekarz"],
          open:["Drzwi od zaplecza są otwarte, bo piekarze wychodzą na papierosa.", "Wieczorem wchodzi tu każdy, kto chce kupić chleb po godzinach."],
          desc:["Piekarnia, z której w listopadzie pachnie rogalami świętomarcińskimi na pół dzielnicy.","Piece rozgrzewają się o trzeciej w nocy."] },
        { id:"przystan", name:"Przystań nad Wartą", label:"Przystań", gen:"przystani", in:"na przystani", from:"z przystani", icon:"pier", roles:[],
          open:["Szopa z łodziami zamyka się na sznurek.", "Na pomost i do szopy wejdzie każdy, kto przyjdzie od strony wału."],
          desc:["Przystań wioślarska z drewnianym pomostem nad Wartą.","Na ścianie szopy wisi tablica z wynikami regat."] }
      ],
      roles:[
        { id:"piekarz", age:"mid", m:"Piekarz", f:"Piekarka", access:["piekarnia"], outfit:{shape:"apron",c:"#f1f1ea",d:"#d8d2c4"}, headwear:{m:[""],f:["chustka"]},
          flavor:["Ręce ma zawsze białe od mąki.","Na Świętego Marcina piecze rogale przez całą noc."] },
        { id:"targi", age:["young","mid"], m:"Pracownik Targów Poznańskich", f:"Pracownica Targów Poznańskich", access:[], outfit:{shape:"collar",c:"#3e4a6b",d:"#e6e6e6"}, headwear:{m:[""],f:[""]},
          flavor:["W czerwcu nie ma czasu na nic, bo na targi zjeżdża pół Europy."] }
      ],
      flavor:["Na tramwaj mówi wyłącznie „bimba”.","Do kawy zawsze bierze sznekę z glancem.","Mówi „tej” prawie w każdym zdaniu.",
              "Na ziemniaki mówi „pyry” i nie zna innego słowa.","Każdą złotówkę obraca dwa razy, zanim ją wyda."],
      quips:["Tej, kolejna sprawa z głowy."]
    },

    krakow: {
      name:"Kraków",
      district:{ nom:"Kazimierz", gen:"Kazimierza", na:"na Kazimierzu", po:"po Kazimierzu" },
      streets:["Szerokiej","Józefa","Miodowej","Krakowskiej","Dietla","Estery","Bożego Ciała","Meiselsa","Starowiślnej","Augustiańskiej"],
      market:{ on:"na Starym Kleparzu", from:"ze Starego Kleparza", to:"na Stary Kleparz" },
      bars:["Pod Baranami","U Wróbla","Pod Wawelem"],
      church_at:"w kościele Bożego Ciała", teams:["Wisły","Cracovii"], cinema:"Kijów", gazeta:"Gazeta Krakowska",
      dworzec:"Dworcu Głównym", szpital:"szpitalu miejskim", walk:"nad Wisłę, pod Wawel", uni:"UJ",
      zaklad_at:[ {t:"w Hucie im. Lenina", years:[1989,1989]}, {t:"w Hucie im. Sendzimira", years:[1990,1999]} ],
      worker:{ id:"worker", age:["young","mid"], m:"Hutnik z Nowej Huty", f:"Laborantka z huty", access:[],
        outfit:{shape:"plain",c:"#5a3a2a",d:"#9a7550"}, headwear:{m:["kaszkiet"],f:[""]},
        flavor:["Codziennie dojeżdża tramwajem do kombinatu w Nowej Hucie.","Mówi, że huta to całe [jego|jej] życie."] },
      locations:[
        { id:"stajnia", name:"Stajnia dorożkarska", label:"Stajnia", gen:"stajni", in:"w stajni", from:"ze stajni", icon:"stable", roles:["dorozkarz"],
          open:["Wrota stajni stoją otwarte, żeby konie miały powietrze.", "Stajnię zamyka się dopiero na noc, wieczorem kręcą się tu dorożkarze i ich znajomi."],
          desc:["Stajnia w podwórku, skąd rano wyjeżdżają dorożki na Rynek.","Pachnie sianem, skórą i końmi."] },
        { id:"piwnica_jazz", name:"Piwnica jazzowa", label:"Klub", gen:"klubu", in:"w piwnicy jazzowej", from:"z piwnicy jazzowej", icon:"cellar", roles:["muzyk"],
          open:["Wieczorem wejdzie każdy, kto zapłaci za bilet.", "Bramkarz wpuszcza każdego, kto zna któregoś z muzyków."],
          desc:["Ceglana piwnica z małą sceną i fortepianem bez jednego klawisza.","Grają tu do rana, a dym siwieje pod sklepieniem."] }
      ],
      roles:[
        { id:"dorozkarz", age:["mid","old"], m:"Dorożkarz z Rynku", f:null, access:[], outfit:{shape:"jacket",c:"#2b2b2b",d:"#c9a646"}, headwear:{m:["kaszkiet"]},
          flavor:["Wozi turystów dorożką wokół Rynku.","Konia zna lepiej niż własną rodzinę."] },
        { id:"muzyk", age:["young","mid"], m:"Muzyk jazzowy", f:"Wokalistka jazzowa", access:["piwnica_jazz"], outfit:{shape:"collar",c:"#1f1f22",d:"#c9a646"}, headwear:{m:["beret",""],f:[""]},
          flavor:["Gra do rana w piwnicy przy Rynku.","Mówi, że prawdziwy jazz skończył się na Komedzie."] },
        { id:"obwarzanki", age:["mid","old"], m:"Sprzedawca obwarzanków", f:"Sprzedawczyni obwarzanków", access:[], outfit:{shape:"apron",c:"#8a6d55",d:"#e8d9c1"}, headwear:{m:["kaszkiet"],f:["chustka"]},
          flavor:["Od świtu stoi z wózkiem obwarzanków przy Plantach."] }
      ],
      flavor:["Mówi, że wychodzi „na pole”, a nie na dwór.","Codziennie rano kupuje obwarzanka na rogu.",
              "Narzeka na turystów, choć [sam|sama] na nich zarabia.","Wie, w której piwnicy przy Rynku grają najlepszy jazz."],
      quips:["Hejnał jeszcze nie zagrał, a sprawa zamknięta."]
    },

    lodz: {
      name:"Łódź",
      district:{ nom:"Bałuty", gen:"Bałut", na:"na Bałutach", po:"po Bałutach" },
      streets:["Zgierskiej","Limanowskiego","Łagiewnickiej","Franciszkańskiej","Smugowej","Lutomierskiej","Wojska Polskiego","Drewnowskiej","Piotrkowskiej","Ogrodowej"],
      market:{ on:"na Bałuckim Rynku", from:"z Bałuckiego Rynku", to:"na Bałucki Rynek" },
      bars:["Pod Fabrykantem","Na Bałutach","U Szymona"],
      church_at:"w archikatedrze", teams:["ŁKS-u","Widzewa"], cinema:"Bałtyk", gazeta:"Express Ilustrowany",
      dworzec:"Dworcu Fabrycznym", szpital:"szpitalu miejskim", walk:"do parku na Zdrowiu", uni:"filmówki",
      zaklad_at:"w zakładach włókienniczych",
      worker:{ id:"worker", age:["young","mid"], m:"Majster z przędzalni", f:"Włókniarka", access:[],
        outfit:{shape:"apron",c:"#7d6a8f",d:"#d8cfe3"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Pracuje na trzy zmiany przy krosnach, jak kiedyś [jego|jej] matka.",
                {t:"Boi się, że fabryka padnie jak sąsiednie zakłady.", years:[1990,1999]}] },
      locations:[
        { id:"przedzalnia", name:"Hala przędzalni", label:"Przędzalnia", gen:"przędzalni", in:"w przędzalni", from:"z przędzalni", icon:"factory", roles:["worker"],
          open:["Na zmianie przez portiernię przechodzą setki ludzi i nikt nie sprawdza przepustek.", "Boczna brama od torów nie ma stróża."],
          desc:["Hala z ceglanymi łukami i rzędami maszyn, które nie milkną nawet nocą.","Na portierni wisi tablica z kluczami do każdego oddziału."] },
        { id:"filmowka", name:"Magazyn rekwizytów filmówki", label:"Rekwizytornia", gen:"rekwizytorni", in:"w rekwizytorni", from:"z rekwizytorni filmówki", icon:"workshop", roles:["student"],
          open:["Zeszyt wypożyczeń leży otwarty, a drzwi stoją uchylone.", "Wieczorem ciągle ktoś coś stąd wynosi na zdjęcia i nikt nie pilnuje drzwi."],
          desc:["Magazyn w pałacu przy Targowej, pełen kostiumów, reflektorów i starych taśm.","Studenci pożyczają stąd sprzęt na etiudy, wpisując się do zeszytu."] }
      ],
      roles:[],
      flavor:["Na bułkę mówi „angielka”.","Mieszka w kamienicy z podwórkiem-studnią.","Pamięta, jak fabryczne syreny wyznaczały rytm dnia.",
              "W niedzielę zawsze spaceruje po Piotrkowskiej."],
      quips:["W Łodzi każdy każdego zna, więc i tak by się wydało."]
    },

    gdansk: {
      name:"Gdańsk",
      district:{ nom:"Wrzeszcz", gen:"Wrzeszcza", na:"we Wrzeszczu", po:"po Wrzeszczu" },
      streets:["Wajdeloty","Grunwaldzkiej","Jaśkowej Doliny","Danusi","Konopnickiej","Lendziona","Kościuszki","Mickiewicza","Aldony","Partyzantów"],
      market:{ on:"w Hali Targowej", from:"z Hali Targowej", to:"do Hali Targowej" },
      bars:["Pod Żurawiem","Kotwica","U Rybaka"],
      church_at:"w Bazylice Mariackiej", teams:["Lechii"], cinema:"Neptun", gazeta:"Dziennik Bałtycki",
      dworzec:"Dworcu Głównym", szpital:"szpitalu miejskim", walk:"nad morze, do Brzeźna", uni:"Politechniki",
      zaklad_at:"w Stoczni Gdańskiej",
      worker:{ id:"worker", age:["young","mid"], m:"Stoczniowiec", f:"Suwnicowa ze stoczni", access:[],
        outfit:{shape:"plain",c:"#2f4f6f",d:"#c9a646"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Od lat pracuje przy pochylni w stoczni.","Przy każdej okazji wspomina sierpień osiemdziesiątego."] },
      locations:[
        { id:"szopa_rybacka", name:"Szopa rybacka w Brzeźnie", label:"Szopa", gen:"szopy rybackiej", in:"w szopie rybackiej", from:"z szopy rybackiej", icon:"shed", roles:["rybak"],
          open:["Szopa na plaży nie ma zamka, tylko drewniany skobel.", "Rybacy nigdy nie zamykają szopy. Mówią, że i tak wszyscy się znają."],
          desc:["Smołowana szopa na plaży, pełna sieci i skrzynek na ryby.","Od morza ciągnie chłodem, a w środku pachnie śledziem."] },
        { id:"magazyn_port", name:"Magazyn w porcie", label:"Nabrzeże", gen:"magazynu portowego", in:"w magazynie portowym", from:"z magazynu w porcie", icon:"garage", roles:["portowiec"],
          open:["W ogrodzeniu nabrzeża jest dziura, o której wiedzą wszyscy portowcy.", "Brama magazynu stoi otwarta, bo wieczorem jeszcze rozładowują frachtowiec."],
          desc:["Magazyn przy nabrzeżu, gdzie składa się towar z frachtowców.","Magazyn z czerwonej cegły, pełen skrzyń i worków z kawą."] }
      ],
      roles:[
        { id:"rybak", age:["mid","old"], m:"Rybak z Brzeźna", f:null, access:[], outfit:{shape:"jacket",c:"#3e4a6b",d:"#c9d9e0"}, headwear:{m:["beret"]},
          flavor:["Wypływa łodzią przed świtem.","Ręce ma spękane od soli."] },
        { id:"portowiec", age:["young","mid"], m:"Portowiec", f:null, access:[], outfit:{shape:"plain",c:"#5c2f2f",d:"#d9a648"}, headwear:{m:["kaszkiet"]},
          flavor:["Wie, co przypłynęło do portu, zanim przeczyta o tym gazeta."] }
      ],
      flavor:["W weekendy jeździ kolejką do Sopotu.","W szufladzie trzyma bursztyn znaleziony na plaży.","Zimą chodzi nad morze patrzeć na sztorm."],
      quips:["Wiatr od morza wszystko wywieje, ale tej sprawy już nie."]
    },

    katowice: {
      name:"Katowice",
      district:{ nom:"Nikiszowiec", gen:"Nikiszowca", na:"na Nikiszowcu", po:"po Nikiszu" },
      streets:["Szopienickiej","Odrzańskiej","Rymarskiej","Zamkowej","Krawczyka","Janowskiej","Mariackiej","Gliwickiej"],
      market:{ on:"na targowisku w Szopienicach", from:"z targowiska w Szopienicach", to:"na targowisko w Szopienicach" },
      bars:["Pod Szybem","U Ecika","Na Grubie"],
      church_at:"w kościele św. Anny", teams:["GieKSy"], cinema:"Rialto", gazeta:"Trybuna Śląska",
      dworzec:"Dworcu Głównym", szpital:"szpitalu górniczym", walk:"do Parku Śląskiego", uni:"Uniwersytetu Śląskiego",
      zaklad_at:"na kopalni „Wieczorek”",
      worker:{ id:"worker", age:["young","mid"], m:"Górnik z „Wieczorka”", f:"Lampiarka z kopalni", access:[],
        outfit:{shape:"plain",c:"#1f1f22",d:"#3a3a40"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Po szychcie zawsze idzie z kamratami na piwo.","Pod paznokciami ma pył węglowy, którego nie da się domyć."] },
      locations:[
        { id:"golebnik", name:"Gołębnik na strychu familoka", label:"Gołębnik", gen:"gołębnika", in:"w gołębniku", from:"z gołębnika", icon:"dovecote", roles:["golebiarz"],
          open:["Drzwi na strych familoka nie mają zamka.", "Gołębnik zamyka się na haczyk, który otworzy każdy."],
          desc:["Gołębnik na strychu, z wylotem nad dachami familoków.","Pachnie zbożem, a na ścianie wiszą dyplomy z lotów."] },
        { id:"lampownia", name:"Lampownia kopalni „Wieczorek”", label:"Lampownia", gen:"lampowni", in:"w lampowni", from:"z lampowni", icon:"mine", roles:["worker"],
          open:["Przy zmianie szychty przez lampownię przechodzi cała zmiana i nikt nikogo nie pilnuje.", "Okienko lampowni jest otwarte przez całą noc."],
          desc:["Lampownia pod szybem, gdzie górnicy pobierają lampy przed szychtą.","Na regałach równe rzędy lamp i numerowanych znaczków."] }
      ],
      roles:[
        { id:"golebiarz", age:"old", m:"Gołębiarz", f:null, access:[], outfit:{shape:"jacket",c:"#4f5560",d:"#a9b4c0"}, headwear:{m:["kaszkiet"]},
          flavor:["Jego gołębie wracały z lotów z Niemiec szybciej niż pociąg.","Na strychu ma gołębnik i zna każdego ptaka po imieniu."] }
      ],
      flavor:["Mieszka w familoku od urodzenia.","Na niedzielny obiad zawsze są rolady, modro kapusta i kluski.",
              "Mówi po śląsku tak, że przybysze nic nie rozumieją.","Na balkonie suszy pranie, choć z kopalni wciąż leci sadza."],
      quips:["Szczęść Boże. Sprawa zamknięta przed szychtą."]
    },

    wroclaw: {
      name:"Wrocław",
      district:{ nom:"Nadodrze", gen:"Nadodrza", na:"na Nadodrzu", po:"po Nadodrzu" },
      streets:["Jedności Narodowej","Roosevelta","Kurkowej","Dubois","Pomorskiej","Łokietka","Trzebnickiej","Słowiańskiej","Daszyńskiego","Prusa"],
      market:{ on:"w Hali Targowej", from:"z Hali Targowej", to:"do Hali Targowej" },
      bars:["Pod Kalamburem","U Krasnala","Na Nadodrzu"],
      church_at:"w katedrze na Ostrowie Tumskim", teams:["Śląska"], cinema:"Warszawa", gazeta:"Wieczór Wrocławia",
      dworzec:"Dworcu Głównym", szpital:"szpitalu miejskim", walk:"nad Odrę", uni:"Politechniki",
      zaklad_at:"w Pafawagu",
      worker:{ id:"worker", age:["young","mid"], m:"Robotnik z Pafawagu", f:"Robotnica z Pafawagu", access:[],
        outfit:{shape:"plain",c:"#3d5a85",d:"#2b3f5e"}, headwear:{m:["kaszkiet"],f:["chustka"]},
        flavor:["Od lat buduje lokomotywy w Pafawagu."] },
      locations:[
        { id:"zajezdnia", name:"Zajezdnia tramwajowa", label:"Zajezdnia", gen:"zajezdni", in:"w zajezdni", from:"z zajezdni", icon:"depot", roles:["motorniczy"],
          open:["Bramą wjeżdżają i wyjeżdżają tramwaje, a portier ledwo nadąża.", "Furtki od strony torów nikt nie pilnuje."],
          desc:["Zajezdnia z ceglaną halą i kanałami pod torami.","Nocą stoją tu rzędem tramwaje, a dyżurny gra w karty w kanciapie."] },
        { id:"przystan", name:"Przystań nad Odrą", label:"Przystań", gen:"przystani", in:"na przystani", from:"z przystani", icon:"pier", roles:[],
          open:["Szopa z łodziami zamyka się na sznurek.", "Na pomost i do szopy wejdzie każdy, kto przyjdzie od strony wału."],
          desc:["Pomost nad Odrą, z łodziami przypiętymi łańcuchem.","Wieczorem nad wodą unosi się mgła."] }
      ],
      roles:[],
      flavor:["Mieszka w Trójkącie Bermudzkim i nikogo się nie boi.","Babcia przyjechała tu ze Lwowa i do dziś mówi z zaśpiewem.",
              {t:"Pamięta, jak w powodzi w 1997 roku woda zalała całe podwórko.", years:[1998,1999]}],
      quips:["Odra płynie spokojnie, a sprawa rozwiązana."]
    }
  };

  root.SIATKA_CITIES = CITIES;
  if (typeof module !== "undefined" && module.exports) module.exports = CITIES;
})(typeof window !== "undefined" ? window : globalThis);
