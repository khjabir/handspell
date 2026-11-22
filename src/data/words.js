// Word lists for practice and reading. Fingerspelling is used most for names, places and
// words without a sign of their own, so there are plenty of names here.

export const WORD_LISTS = {
  short: {
    label: 'Short words',
    note: 'Three-letter words',
    words: ['CAT', 'DOG', 'SUN', 'HAT', 'RED', 'BUS', 'PIG', 'CUP', 'MAP', 'BOX', 'FAN', 'BED', 'TOP', 'ANT', 'OWL', 'EGG', 'ICE', 'LEG', 'ARM', 'NET', 'PEN', 'COW', 'FOX', 'BAT', 'WEB', 'TEA', 'OAK', 'SKY', 'BOW', 'RUG', 'HUG', 'FLY', 'KEY', 'TOY', 'YES', 'MOM', 'DAD', 'CAR', 'VAN', 'GUM'],
  },
  everyday: {
    label: 'Everyday words',
    note: 'Four and five letters',
    words: ['HELP', 'HOME', 'BOOK', 'MILK', 'RAIN', 'BLUE', 'FISH', 'TREE', 'DOOR', 'BIRD', 'WORK', 'PLAY', 'FOOD', 'GOOD', 'TIME', 'WATER', 'HAPPY', 'HOUSE', 'PHONE', 'MUSIC', 'TRAIN', 'BREAD', 'PIZZA', 'PARTY', 'SMILE', 'SPORT', 'STORY', 'LIGHT', 'PLANT', 'TABLE', 'CLOCK', 'GREEN', 'APPLE', 'MONEY', 'NIGHT', 'HELLO', 'THANKS', 'FRIEND', 'SCHOOL', 'FAMILY'],
  },
  names: {
    label: 'Names',
    note: 'Names are what people fingerspell most',
    words: ['ANA', 'BEN', 'LEO', 'MIA', 'RAVI', 'ASHA', 'OMAR', 'ZOE', 'JACK', 'MARIA', 'PRIYA', 'ARJUN', 'SOFIA', 'NOAH', 'EMMA', 'LIAM', 'AISHA', 'KENJI', 'ELENA', 'DIEGO', 'FATIMA', 'MEERA', 'JAMES', 'OLIVIA', 'ROHAN', 'LUCAS', 'HANNAH', 'KAVYA', 'YUSUF', 'GRACE', 'ADITI', 'SAMIR', 'NADIA', 'TARA', 'VIKRAM', 'JULIA', 'ISAAC', 'ANIKA', 'MATEO', 'ZARA'],
  },
  animals: {
    label: 'Animals',
    note: 'From cat to zebra',
    words: ['LION', 'BEAR', 'DUCK', 'FROG', 'GOAT', 'WOLF', 'DEER', 'CRAB', 'SEAL', 'MOUSE', 'HORSE', 'SHEEP', 'TIGER', 'SNAKE', 'WHALE', 'ZEBRA', 'PANDA', 'KOALA', 'CAMEL', 'OTTER', 'EAGLE', 'SHARK', 'RABBIT', 'MONKEY', 'TURTLE', 'PARROT', 'DONKEY', 'GIRAFFE', 'PENGUIN', 'DOLPHIN'],
  },
  food: {
    label: 'Food',
    note: 'Good for menus and cafés',
    words: ['RICE', 'CAKE', 'SOUP', 'TACO', 'PEAR', 'LIME', 'KIWI', 'CORN', 'DAL', 'ROTI', 'PASTA', 'MANGO', 'LEMON', 'SALAD', 'BAGEL', 'CURRY', 'HONEY', 'GRAPE', 'MELON', 'SUSHI', 'JUICE', 'TOAST', 'COFFEE', 'BANANA', 'CHEESE', 'COOKIE', 'BUTTER', 'NOODLE', 'WAFFLE', 'PAPAYA'],
  },
  places: {
    label: 'Places in India',
    note: 'Cities and states',
    words: ['GOA', 'AGRA', 'PUNE', 'DELHI', 'KOCHI', 'PATNA', 'SURAT', 'SHIMLA', 'MUMBAI', 'JAIPUR', 'INDORE', 'NAGPUR', 'BHOPAL', 'MYSURU', 'RANCHI', 'KERALA', 'ASSAM', 'PUNJAB', 'KOLKATA', 'CHENNAI', 'MADURAI', 'LUCKNOW', 'GUJARAT', 'ODISHA', 'SIKKIM', 'MANIPUR', 'VARANASI', 'HYDERABAD', 'BENGALURU', 'AMRITSAR'],
  },
  long: {
    label: 'Long words',
    note: 'Seven letters and more',
    words: ['RAINBOW', 'KITCHEN', 'PICTURE', 'JOURNEY', 'BLANKET', 'TEACHER', 'BICYCLE', 'BALLOON', 'AIRPORT', 'LIBRARY', 'COMPUTER', 'MOUNTAIN', 'SANDWICH', 'ELEPHANT', 'HOSPITAL', 'BIRTHDAY', 'UMBRELLA', 'DINOSAUR', 'SUNSHINE', 'CHOCOLATE', 'TELEPHONE', 'BUTTERFLY', 'ADVENTURE', 'WATERMELON', 'BASKETBALL'],
  },
};

/** A word for today, the same for everyone on the same day. */
export function wordOfTheDay(date = new Date()) {
  const all = Object.values(WORD_LISTS).flatMap((l) => l.words).filter((w) => w.length >= 4 && w.length <= 7);
  const key = date.getFullYear() * 1000 + Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  let h = key;
  h = ((h >>> 16) ^ h) * 0x45d9f3b; h = ((h >>> 16) ^ h) * 0x45d9f3b; h = (h >>> 16) ^ h;
  return all[Math.abs(h) % all.length];
}
