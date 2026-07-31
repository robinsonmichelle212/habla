import type { VocabTheme } from '@/lib/lesson-focus';
import { VOCAB_THEMES } from '@/lib/lesson-focus';

export type RegionalNote = {
  spain: string;
  argentina: string;
};

export type ThemedVocabWord = {
  spanish: string;
  english: string;
  definition: string;
  exampleSpanish: string;
  exampleEnglish: string;
  regional?: RegionalNote;
};

export type ThemedPhrase = {
  spanish: string;
  english: string;
  regional?: RegionalNote;
};

export type ThemedVerb = {
  infinitive: string;
  english: string;
  forms: string[]; // short useful conjugations, e.g. "como / comes / come"
};

export type ThemedVocabularyTheme = {
  id: VocabTheme;
  emoji: string;
  title: string;
  words: ThemedVocabWord[];
  phrases: ThemedPhrase[];
  verbs: ThemedVerb[];
};

function sortBySpanish<T extends { spanish?: string; infinitive?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = (a.spanish ?? a.infinitive ?? '').localeCompare(b.spanish ?? b.infinitive ?? '', 'es');
    return left;
  });
}

export const THEMED_VOCABULARY: ThemedVocabularyTheme[] = [
  {
    id: 'Food and cooking',
    emoji: '🍕',
    title: 'Food and Cooking',
    words: sortBySpanish([
      { spanish: 'el aceite', english: 'oil', definition: 'Cooking oil, usually olive oil in Spain.', exampleSpanish: 'Añade un poco de aceite de oliva.', exampleEnglish: 'Add a little olive oil.' },
      { spanish: 'el ajo', english: 'garlic', definition: 'Garlic clove or flavouring.', exampleSpanish: 'Echa un diente de ajo.', exampleEnglish: 'Add a clove of garlic.' },
      { spanish: 'la bebida', english: 'drink', definition: 'Any drink — water, soft drink, wine.', exampleSpanish: '¿Qué bebida quieres?', exampleEnglish: 'What drink do you want?' },
      { spanish: 'la carne', english: 'meat', definition: 'Meat in general (beef, pork, etc.).', exampleSpanish: 'No como mucha carne.', exampleEnglish: 'I don’t eat much meat.' },
      { spanish: 'la cena', english: 'dinner', definition: 'Evening meal.', exampleSpanish: 'La cena es a las nueve.', exampleEnglish: 'Dinner is at nine.' },
      { spanish: 'el postre', english: 'dessert', definition: 'Sweet course after a meal.', exampleSpanish: 'De postre quiero flan.', exampleEnglish: 'For dessert I want flan.' },
      { spanish: 'el desayuno', english: 'breakfast', definition: 'Morning meal.', exampleSpanish: 'El desayuno es café con tostadas.', exampleEnglish: 'Breakfast is coffee with toast.' },
      { spanish: 'el plato', english: 'dish / plate', definition: 'A prepared dish or a physical plate.', exampleSpanish: 'Este plato está delicioso.', exampleEnglish: 'This dish is delicious.' },
      { spanish: 'el sabor', english: 'flavour / taste', definition: 'How something tastes.', exampleSpanish: 'Tiene un sabor dulce.', exampleEnglish: 'It has a sweet flavour.' },
      { spanish: 'la sal', english: 'salt', definition: 'Table salt.', exampleSpanish: 'Le falta un poco de sal.', exampleEnglish: 'It needs a bit of salt.' },
      { spanish: 'el azúcar', english: 'sugar', definition: 'Sugar for coffee, baking, etc.', exampleSpanish: '¿Quieres azúcar en el café?', exampleEnglish: 'Do you want sugar in the coffee?' },
      { spanish: 'la verdura', english: 'vegetables', definition: 'Vegetables as a food group.', exampleSpanish: 'Como verdura todos los días.', exampleEnglish: 'I eat vegetables every day.' },
      { spanish: 'el pescado', english: 'fish', definition: 'Fish as food (not the live animal pez).', exampleSpanish: 'Pedimos pescado a la plancha.', exampleEnglish: 'We ordered grilled fish.' },
      { spanish: 'la cuenta', english: 'the bill', definition: 'Restaurant bill / check.', exampleSpanish: '¿Nos trae la cuenta, por favor?', exampleEnglish: 'Could you bring us the bill, please?' },
      { spanish: 'el menú', english: 'menu / set menu', definition: 'List of dishes; in Spain often the lunch set menu.', exampleSpanish: 'El menú del día es muy bueno.', exampleEnglish: 'The set lunch menu is very good.' },
      { spanish: 'el camarero', english: 'waiter', definition: 'Male waiter.', exampleSpanish: 'El camarero fue muy amable.', exampleEnglish: 'The waiter was very kind.', regional: { spain: 'camarero / camarera', argentina: 'mozo / moza' } },
      { spanish: 'la propina', english: 'tip', definition: 'Tip left for service.', exampleSpanish: 'Dejamos propina.', exampleEnglish: 'We left a tip.' },
      { spanish: 'rico / rica', english: 'tasty / delicious', definition: 'Informal praise for food.', exampleSpanish: '¡Qué rico está!', exampleEnglish: 'How tasty it is!' },
      { spanish: 'picante', english: 'spicy', definition: 'Hot / chilli spicy.', exampleSpanish: 'No me gusta demasiado picante.', exampleEnglish: 'I don’t like it too spicy.' },
      { spanish: 'la receta', english: 'recipe', definition: 'Cooking instructions.', exampleSpanish: 'Seguí la receta de mi abuela.', exampleEnglish: 'I followed my grandma’s recipe.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Qué me recomienda?', english: 'What do you recommend?' },
      { spanish: 'Estoy a régimen', english: 'I’m on a diet' },
      { spanish: '¡Que aproveche!', english: 'Enjoy your meal!' },
      { spanish: 'La cuenta, por favor', english: 'The bill please' },
      { spanish: '¿Está incluido el servicio?', english: 'Is service included?' },
      { spanish: 'Para mí, lo de siempre', english: 'The usual for me' },
      { spanish: '¿Hay opción vegetariana?', english: 'Is there a vegetarian option?' },
      { spanish: 'Sin cebolla, por favor', english: 'Without onion, please' },
      { spanish: 'Está buenísimo', english: 'It’s really good' },
      { spanish: '¿Me pone un poco más?', english: 'Could I have a bit more?' },
    ]),
    verbs: [
      { infinitive: 'comer', english: 'to eat', forms: ['como', 'comes', 'come', 'comemos'] },
      { infinitive: 'cocinar', english: 'to cook', forms: ['cocino', 'cocinas', 'cocina'] },
      { infinitive: 'pedir', english: 'to order / ask for', forms: ['pido', 'pides', 'pide', 'pedimos'] },
      { infinitive: 'probar', english: 'to try / taste', forms: ['pruebo', 'pruebas', 'prueba'] },
      { infinitive: 'recomendar', english: 'to recommend', forms: ['recomiendo', 'recomiendas', 'recomienda'] },
      { infinitive: 'beber', english: 'to drink', forms: ['bebo', 'bebes', 'bebe'] },
    ],
  },
  {
    id: 'Travel and transport',
    emoji: '✈️',
    title: 'Travel and Transport',
    words: sortBySpanish([
      { spanish: 'el aeropuerto', english: 'airport', definition: 'Where planes take off and land.', exampleSpanish: 'Llegamos temprano al aeropuerto.', exampleEnglish: 'We arrived early at the airport.' },
      { spanish: 'el billete', english: 'ticket', definition: 'Travel ticket.', exampleSpanish: 'Compré el billete online.', exampleEnglish: 'I bought the ticket online.', regional: { spain: 'billete', argentina: 'boleto / pasaje' } },
      { spanish: 'el tren', english: 'train', definition: 'Railway train.', exampleSpanish: 'El tren sale a las diez.', exampleEnglish: 'The train leaves at ten.' },
      { spanish: 'el metro', english: 'underground / subway', definition: 'City metro system.', exampleSpanish: 'Voy en metro al centro.', exampleEnglish: 'I’m taking the metro downtown.' },
      { spanish: 'el autobús', english: 'bus', definition: 'City or coach bus.', exampleSpanish: 'El autobús tarda media hora.', exampleEnglish: 'The bus takes half an hour.', regional: { spain: 'autobús', argentina: 'colectivo / bondi' } },
      { spanish: 'el taxi', english: 'taxi', definition: 'Cab.', exampleSpanish: 'Pedimos un taxi.', exampleEnglish: 'We called a taxi.' },
      { spanish: 'la estación', english: 'station', definition: 'Train or bus station.', exampleSpanish: 'Quedamos en la estación.', exampleEnglish: 'We’ll meet at the station.' },
      { spanish: 'el retraso', english: 'delay', definition: 'Being late / delayed.', exampleSpanish: 'Hay un retraso de veinte minutos.', exampleEnglish: 'There’s a twenty-minute delay.' },
      { spanish: 'la maleta', english: 'suitcase', definition: 'Luggage suitcase.', exampleSpanish: 'Mi maleta pesa demasiado.', exampleEnglish: 'My suitcase is too heavy.' },
      { spanish: 'el pasaporte', english: 'passport', definition: 'Travel identity document.', exampleSpanish: 'No olvides el pasaporte.', exampleEnglish: 'Don’t forget your passport.' },
      { spanish: 'el vuelo', english: 'flight', definition: 'Plane journey.', exampleSpanish: 'Nuestro vuelo es por la tarde.', exampleEnglish: 'Our flight is in the afternoon.' },
      { spanish: 'la escala', english: 'layover / stopover', definition: 'Connection between flights.', exampleSpanish: 'Tenemos una escala en Madrid.', exampleEnglish: 'We have a layover in Madrid.' },
      { spanish: 'el andén', english: 'platform', definition: 'Train platform.', exampleSpanish: 'El tren sale del andén tres.', exampleEnglish: 'The train leaves from platform three.' },
      { spanish: 'el horario', english: 'timetable / schedule', definition: 'Times of services.', exampleSpanish: 'Mira el horario del tren.', exampleEnglish: 'Check the train timetable.' },
      { spanish: 'la llegada', english: 'arrival', definition: 'When you arrive.', exampleSpanish: 'La llegada es a las seis.', exampleEnglish: 'Arrival is at six.' },
      { spanish: 'la salida', english: 'departure / exit', definition: 'Leaving; also “exit” signs.', exampleSpanish: 'La salida es a las ocho.', exampleEnglish: 'Departure is at eight.' },
      { spanish: 'el mapa', english: 'map', definition: 'City or route map.', exampleSpanish: 'Necesito un mapa del metro.', exampleEnglish: 'I need a metro map.' },
      { spanish: 'la dirección', english: 'address / direction', definition: 'Street address or way to go.', exampleSpanish: '¿Me das la dirección?', exampleEnglish: 'Can you give me the address?' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Cómo llego al centro?', english: 'How do I get to the centre?' },
      { spanish: '¿A qué hora sale el tren?', english: 'What time does the train leave?' },
      { spanish: '¿Está lejos de aquí?', english: 'Is it far from here?' },
      { spanish: 'Una ida y vuelta, por favor', english: 'A return ticket, please' },
      { spanish: '¿Dónde está la parada?', english: 'Where is the stop?' },
      { spanish: 'Me he perdido', english: 'I’m lost' },
      { spanish: '¿Hace falta reserva?', english: 'Do I need a reservation?' },
      { spanish: 'El vuelo está retrasado', english: 'The flight is delayed' },
      { spanish: '¿Puede ayudarme?', english: 'Can you help me?' },
      { spanish: 'Voy de camino', english: 'I’m on my way' },
    ]),
    verbs: [
      { infinitive: 'viajar', english: 'to travel', forms: ['viajo', 'viajas', 'viaja'] },
      { infinitive: 'llegar', english: 'to arrive', forms: ['llego', 'llegas', 'llega'] },
      { infinitive: 'salir', english: 'to leave / go out', forms: ['salgo', 'sales', 'sale'] },
      { infinitive: 'coger', english: 'to take (transport)', forms: ['cojo', 'coges', 'coge'] },
      { infinitive: 'perder', english: 'to miss / lose', forms: ['pierdo', 'pierdes', 'pierde'] },
      { infinitive: 'conducir', english: 'to drive', forms: ['conduzco', 'conduces', 'conduce'] },
    ],
  },
  {
    id: 'Work and careers',
    emoji: '💼',
    title: 'Work and Careers',
    words: sortBySpanish([
      { spanish: 'el trabajo', english: 'job / work', definition: 'Employment or the act of working.', exampleSpanish: 'Me gusta mi trabajo.', exampleEnglish: 'I like my job.' },
      { spanish: 'la oficina', english: 'office', definition: 'Workplace office.', exampleSpanish: 'Trabajo en una oficina pequeña.', exampleEnglish: 'I work in a small office.' },
      { spanish: 'el jefe', english: 'boss', definition: 'Manager / boss (male form often used generally).', exampleSpanish: 'Mi jefe es exigente.', exampleEnglish: 'My boss is demanding.' },
      { spanish: 'el sueldo', english: 'salary', definition: 'Pay / wages.', exampleSpanish: 'El sueldo es razonable.', exampleEnglish: 'The salary is reasonable.' },
      { spanish: 'la reunión', english: 'meeting', definition: 'Work meeting.', exampleSpanish: 'Tenemos una reunión a las once.', exampleEnglish: 'We have a meeting at eleven.' },
      { spanish: 'el horario', english: 'working hours / schedule', definition: 'When you work.', exampleSpanish: 'Mi horario es flexible.', exampleEnglish: 'My schedule is flexible.' },
      { spanish: 'el contrato', english: 'contract', definition: 'Employment contract.', exampleSpanish: 'Firmaré el contrato mañana.', exampleEnglish: 'I’ll sign the contract tomorrow.' },
      { spanish: 'la entrevista', english: 'interview', definition: 'Job interview.', exampleSpanish: 'Tengo una entrevista el lunes.', exampleEnglish: 'I have an interview on Monday.' },
      { spanish: 'el currículum', english: 'CV / résumé', definition: 'Curriculum vitae.', exampleSpanish: 'Actualicé mi currículum.', exampleEnglish: 'I updated my CV.' },
      { spanish: 'el proyecto', english: 'project', definition: 'Work project.', exampleSpanish: 'Este proyecto es urgente.', exampleEnglish: 'This project is urgent.' },
      { spanish: 'el plazo', english: 'deadline', definition: 'Time limit to finish something.', exampleSpanish: 'El plazo es el viernes.', exampleEnglish: 'The deadline is Friday.' },
      { spanish: 'el compañero', english: 'colleague', definition: 'Workmate.', exampleSpanish: 'Mis compañeros son geniales.', exampleEnglish: 'My colleagues are great.' },
      { spanish: 'las vacaciones', english: 'holiday / vacation', definition: 'Time off work.', exampleSpanish: 'Pido vacaciones en agosto.', exampleEnglish: 'I’m taking holiday in August.' },
      { spanish: 'el teletrabajo', english: 'remote work', definition: 'Working from home.', exampleSpanish: 'Hago teletrabajo dos días.', exampleEnglish: 'I work remotely two days.' },
      { spanish: 'la formación', english: 'training', definition: 'Professional training.', exampleSpanish: 'Hice un curso de formación.', exampleEnglish: 'I did a training course.' },
      { spanish: 'el ascenso', english: 'promotion', definition: 'Moving up at work.', exampleSpanish: 'Pidió un ascenso.', exampleEnglish: 'He asked for a promotion.' },
      { spanish: 'la empresa', english: 'company', definition: 'Business / firm.', exampleSpanish: 'La empresa crece rápido.', exampleEnglish: 'The company is growing fast.' },
      { spanish: 'el cliente', english: 'client / customer', definition: 'Person or company you serve.', exampleSpanish: 'El cliente está contento.', exampleEnglish: 'The client is happy.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿A qué te dedicas?', english: 'What do you do for a living?' },
      { spanish: 'Estoy buscando trabajo', english: 'I’m looking for a job' },
      { spanish: 'Tengo mucha carga de trabajo', english: 'I have a heavy workload' },
      { spanish: '¿Podemos hablar un momento?', english: 'Can we talk for a moment?' },
      { spanish: 'Lo dejo para mañana', english: 'I’ll leave it for tomorrow' },
      { spanish: 'Estoy en una reunión', english: 'I’m in a meeting' },
      { spanish: 'Te mando un correo', english: 'I’ll send you an email' },
      { spanish: '¿Cuál es el plazo?', english: 'What’s the deadline?' },
      { spanish: 'Trabajo por cuenta propia', english: 'I’m self-employed' },
      { spanish: 'Hoy salgo un poco más tarde', english: 'I’m leaving a bit later today' },
    ]),
    verbs: [
      { infinitive: 'trabajar', english: 'to work', forms: ['trabajo', 'trabajas', 'trabaja'] },
      { infinitive: 'ganar', english: 'to earn / win', forms: ['gano', 'ganas', 'gana'] },
      { infinitive: 'contratar', english: 'to hire', forms: ['contrato', 'contratas', 'contrata'] },
      { infinitive: 'enviar', english: 'to send', forms: ['envío', 'envías', 'envía'] },
      { infinitive: 'organizar', english: 'to organise', forms: ['organizo', 'organizas', 'organiza'] },
      { infinitive: 'presentar', english: 'to present / introduce', forms: ['presento', 'presentas', 'presenta'] },
    ],
  },
  {
    id: 'Health and body',
    emoji: '🏥',
    title: 'Health and Body',
    words: sortBySpanish([
      { spanish: 'el médico', english: 'doctor', definition: 'Medical doctor.', exampleSpanish: 'Voy al médico mañana.', exampleEnglish: 'I’m going to the doctor tomorrow.' },
      { spanish: 'la farmacia', english: 'pharmacy', definition: 'Chemist / drugstore.', exampleSpanish: 'Compré el jarabe en la farmacia.', exampleEnglish: 'I bought the syrup at the pharmacy.' },
      { spanish: 'el dolor', english: 'pain', definition: 'Ache or pain.', exampleSpanish: 'Tengo dolor de cabeza.', exampleEnglish: 'I have a headache.' },
      { spanish: 'la fiebre', english: 'fever', definition: 'High temperature.', exampleSpanish: 'Tiene un poco de fiebre.', exampleEnglish: 'He has a slight fever.' },
      { spanish: 'la cita', english: 'appointment', definition: 'Doctor’s appointment.', exampleSpanish: 'Tengo cita a las cinco.', exampleEnglish: 'I have an appointment at five.' },
      { spanish: 'la receta', english: 'prescription', definition: 'Doctor’s prescription (also recipe).', exampleSpanish: 'Necesito la receta del médico.', exampleEnglish: 'I need the doctor’s prescription.' },
      { spanish: 'el hospital', english: 'hospital', definition: 'Hospital.', exampleSpanish: 'Lo llevaron al hospital.', exampleEnglish: 'They took him to hospital.' },
      { spanish: 'la salud', english: 'health', definition: 'Physical / mental health.', exampleSpanish: 'Cuido mi salud.', exampleEnglish: 'I look after my health.' },
      { spanish: 'el resfriado', english: 'cold', definition: 'Common cold.', exampleSpanish: 'Tengo un resfriado.', exampleEnglish: 'I have a cold.' },
      { spanish: 'la tos', english: 'cough', definition: 'Cough.', exampleSpanish: 'La tos no se me quita.', exampleEnglish: 'I can’t shake this cough.' },
      { spanish: 'la pastilla', english: 'pill / tablet', definition: 'Medicine tablet.', exampleSpanish: 'Tómate una pastilla.', exampleEnglish: 'Take a pill.' },
      { spanish: 'la espalda', english: 'back', definition: 'Body back.', exampleSpanish: 'Me duele la espalda.', exampleEnglish: 'My back hurts.' },
      { spanish: 'la garganta', english: 'throat', definition: 'Throat.', exampleSpanish: 'Tengo la garganta irritada.', exampleEnglish: 'My throat is sore.' },
      { spanish: 'el estómago', english: 'stomach', definition: 'Stomach.', exampleSpanish: 'Me duele el estómago.', exampleEnglish: 'My stomach hurts.' },
      { spanish: 'el seguro', english: 'insurance', definition: 'Health / medical insurance.', exampleSpanish: '¿Aceptan mi seguro?', exampleEnglish: 'Do you accept my insurance?' },
      { spanish: 'la alergia', english: 'allergy', definition: 'Allergic reaction / condition.', exampleSpanish: 'Tengo alergia al polen.', exampleEnglish: 'I’m allergic to pollen.' },
      { spanish: 'el ejercicio', english: 'exercise', definition: 'Physical exercise.', exampleSpanish: 'Hago ejercicio tres veces por semana.', exampleEnglish: 'I exercise three times a week.' },
      { spanish: 'el sueño', english: 'sleep / dream', definition: 'Sleep; also a dream.', exampleSpanish: 'Necesito dormir más.', exampleEnglish: 'I need to sleep more.' },
    ]),
    phrases: sortBySpanish([
      { spanish: 'Me duele la cabeza', english: 'My head hurts' },
      { spanish: 'No me siento bien', english: 'I don’t feel well' },
      { spanish: '¿Tiene algo para el dolor?', english: 'Do you have something for the pain?' },
      { spanish: 'Estoy exhausto', english: 'I’m exhausted' },
      { spanish: 'Necesito descanso', english: 'I need rest' },
      { spanish: '¿Cuándo es la próxima cita?', english: 'When is the next appointment?' },
      { spanish: 'Soy alérgico a…', english: 'I’m allergic to…' },
      { spanish: 'Me encuentro mejor', english: 'I feel better' },
      { spanish: 'Hay que beber más agua', english: 'You should drink more water' },
      { spanish: 'Voy a tomarme el día libre', english: 'I’m going to take the day off' },
    ]),
    verbs: [
      { infinitive: 'doler', english: 'to hurt', forms: ['me duele', 'te duele', 'le duele'] },
      { infinitive: 'toser', english: 'to cough', forms: ['toso', 'toses', 'tose'] },
      { infinitive: 'curar', english: 'to cure / heal', forms: ['curo', 'curas', 'cura'] },
      { infinitive: 'mejorar', english: 'to improve / get better', forms: ['mejoro', 'mejoras', 'mejora'] },
      { infinitive: 'descansar', english: 'to rest', forms: ['descanso', 'descansas', 'descansa'] },
      { infinitive: 'tomar', english: 'to take (medicine)', forms: ['tomo', 'tomas', 'toma'] },
    ],
  },
  {
    id: 'Weather and environment',
    emoji: '🌤️',
    title: 'Weather and Environment',
    words: sortBySpanish([
      { spanish: 'el tiempo', english: 'weather / time', definition: 'Weather (also “time”).', exampleSpanish: '¿Qué tiempo hace?', exampleEnglish: 'What’s the weather like?' },
      { spanish: 'la lluvia', english: 'rain', definition: 'Rain.', exampleSpanish: 'Hoy hay lluvia.', exampleEnglish: 'There’s rain today.' },
      { spanish: 'el sol', english: 'sun', definition: 'The sun.', exampleSpanish: 'Hace mucho sol.', exampleEnglish: 'It’s very sunny.' },
      { spanish: 'el viento', english: 'wind', definition: 'Wind.', exampleSpanish: 'Hace viento en la costa.', exampleEnglish: 'It’s windy on the coast.' },
      { spanish: 'la nube', english: 'cloud', definition: 'Cloud.', exampleSpanish: 'Hay muchas nubes.', exampleEnglish: 'There are lots of clouds.' },
      { spanish: 'la tormenta', english: 'storm', definition: 'Storm.', exampleSpanish: 'Se acerca una tormenta.', exampleEnglish: 'A storm is coming.' },
      { spanish: 'la temperatura', english: 'temperature', definition: 'How hot or cold it is.', exampleSpanish: 'La temperatura sube por la tarde.', exampleEnglish: 'The temperature rises in the afternoon.' },
      { spanish: 'el calor', english: 'heat', definition: 'Hot weather.', exampleSpanish: 'Hace un calor horrible.', exampleEnglish: 'It’s terribly hot.' },
      { spanish: 'el frío', english: 'cold', definition: 'Cold weather.', exampleSpanish: 'Hace frío por la mañana.', exampleEnglish: 'It’s cold in the morning.' },
      { spanish: 'la humedad', english: 'humidity', definition: 'Damp air.', exampleSpanish: 'Hay mucha humedad.', exampleEnglish: 'It’s very humid.' },
      { spanish: 'el medio ambiente', english: 'environment', definition: 'Natural environment.', exampleSpanish: 'Cuidamos el medio ambiente.', exampleEnglish: 'We look after the environment.' },
      { spanish: 'la basura', english: 'rubbish / trash', definition: 'Waste.', exampleSpanish: 'Tira la basura aquí.', exampleEnglish: 'Put the rubbish here.' },
      { spanish: 'el reciclaje', english: 'recycling', definition: 'Recycling.', exampleSpanish: 'El reciclaje es importante.', exampleEnglish: 'Recycling is important.' },
      { spanish: 'la contaminación', english: 'pollution', definition: 'Air / water pollution.', exampleSpanish: 'Hay mucha contaminación en la ciudad.', exampleEnglish: 'There’s a lot of pollution in the city.' },
      { spanish: 'el clima', english: 'climate', definition: 'Long-term climate.', exampleSpanish: 'El clima está cambiando.', exampleEnglish: 'The climate is changing.' },
      { spanish: 'la sombra', english: 'shade', definition: 'Shade from the sun.', exampleSpanish: 'Nos sentamos a la sombra.', exampleEnglish: 'We sat in the shade.' },
      { spanish: 'el paraguas', english: 'umbrella', definition: 'Umbrella.', exampleSpanish: 'Lleva el paraguas.', exampleEnglish: 'Take the umbrella.' },
      { spanish: 'la previsión', english: 'forecast', definition: 'Weather forecast.', exampleSpanish: 'Mira la previsión del tiempo.', exampleEnglish: 'Check the weather forecast.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Qué tiempo hace?', english: 'What’s the weather like?' },
      { spanish: 'Hace un frío que pela', english: 'It’s freezing' },
      { spanish: 'Parece que va a llover', english: 'It looks like it’s going to rain' },
      { spanish: 'Hoy hace un día precioso', english: 'It’s a beautiful day today' },
      { spanish: 'No soporto este calor', english: 'I can’t stand this heat' },
      { spanish: 'Está nublado', english: 'It’s cloudy' },
      { spanish: 'Ha escampado', english: 'It’s cleared up' },
      { spanish: 'Lleva chaqueta, por si acaso', english: 'Take a jacket, just in case' },
      { spanish: 'El aire está muy seco', english: 'The air is very dry' },
      { spanish: 'Hay que reciclar más', english: 'We need to recycle more' },
    ]),
    verbs: [
      { infinitive: 'llover', english: 'to rain', forms: ['llueve', 'llovió', 'va a llover'] },
      { infinitive: 'hacer', english: 'to be (weather)', forms: ['hace sol', 'hace frío', 'hace calor'] },
      { infinitive: 'nevar', english: 'to snow', forms: ['nieva', 'nevó'] },
      { infinitive: 'soplar', english: 'to blow (wind)', forms: ['sopla', 'soplaba'] },
      { infinitive: 'reciclar', english: 'to recycle', forms: ['reciclo', 'reciclas', 'recicla'] },
      { infinitive: 'proteger', english: 'to protect', forms: ['protejo', 'proteges', 'protege'] },
    ],
  },
  {
    id: 'Family and relationships',
    emoji: '👨‍👩‍👧',
    title: 'Family and Relationships',
    words: sortBySpanish([
      { spanish: 'la familia', english: 'family', definition: 'Family.', exampleSpanish: 'Mi familia es pequeña.', exampleEnglish: 'My family is small.' },
      { spanish: 'los padres', english: 'parents', definition: 'Mother and father.', exampleSpanish: 'Mis padres viven cerca.', exampleEnglish: 'My parents live nearby.' },
      { spanish: 'el hermano', english: 'brother', definition: 'Brother.', exampleSpanish: 'Tengo un hermano mayor.', exampleEnglish: 'I have an older brother.' },
      { spanish: 'la hermana', english: 'sister', definition: 'Sister.', exampleSpanish: 'Mi hermana estudia medicina.', exampleEnglish: 'My sister studies medicine.' },
      { spanish: 'el marido', english: 'husband', definition: 'Husband.', exampleSpanish: 'Mi marido cocina muy bien.', exampleEnglish: 'My husband cooks very well.' },
      { spanish: 'la mujer', english: 'wife / woman', definition: 'Wife (also “woman”).', exampleSpanish: 'Mi mujer trabaja en casa.', exampleEnglish: 'My wife works from home.' },
      { spanish: 'el hijo', english: 'son / child', definition: 'Son; plural often “children”.', exampleSpanish: 'Tengo dos hijos.', exampleEnglish: 'I have two children.' },
      { spanish: 'la hija', english: 'daughter', definition: 'Daughter.', exampleSpanish: 'Mi hija tiene cinco años.', exampleEnglish: 'My daughter is five.' },
      { spanish: 'el amigo', english: 'friend', definition: 'Friend (male / generic).', exampleSpanish: 'Quedé con un amigo.', exampleEnglish: 'I met up with a friend.' },
      { spanish: 'la pareja', english: 'partner / couple', definition: 'Romantic partner or a couple.', exampleSpanish: 'Salgo con mi pareja.', exampleEnglish: 'I’m going out with my partner.' },
      { spanish: 'el novio', english: 'boyfriend / fiancé', definition: 'Boyfriend.', exampleSpanish: 'Mi novio es argentino.', exampleEnglish: 'My boyfriend is Argentine.' },
      { spanish: 'la novia', english: 'girlfriend / fiancée', definition: 'Girlfriend.', exampleSpanish: 'Mi novia vive en Sevilla.', exampleEnglish: 'My girlfriend lives in Seville.' },
      { spanish: 'el abuelo', english: 'grandfather', definition: 'Grandfather.', exampleSpanish: 'Mi abuelo cuenta historias.', exampleEnglish: 'My grandfather tells stories.' },
      { spanish: 'la abuela', english: 'grandmother', definition: 'Grandmother.', exampleSpanish: 'Visito a mi abuela los domingos.', exampleEnglish: 'I visit my grandma on Sundays.' },
      { spanish: 'el cuñado', english: 'brother-in-law', definition: 'Sister’s husband / wife’s brother.', exampleSpanish: 'Mi cuñado es simpático.', exampleEnglish: 'My brother-in-law is nice.' },
      { spanish: 'la suegra', english: 'mother-in-law', definition: 'Partner’s mother.', exampleSpanish: 'Mi suegra nos invita a cenar.', exampleEnglish: 'My mother-in-law invites us for dinner.' },
      { spanish: 'la boda', english: 'wedding', definition: 'Wedding ceremony.', exampleSpanish: 'Fuimos a una boda.', exampleEnglish: 'We went to a wedding.' },
      { spanish: 'la pelea', english: 'argument / fight', definition: 'Quarrel.', exampleSpanish: 'Tuvimos una pelea tonta.', exampleEnglish: 'We had a silly argument.' },
    ]),
    phrases: sortBySpanish([
      { spanish: 'Te quiero mucho', english: 'I love you a lot' },
      { spanish: '¿Cómo está tu familia?', english: 'How’s your family?' },
      { spanish: 'Quedamos el sábado', english: 'We’re meeting on Saturday' },
      { spanish: 'Nos caemos muy bien', english: 'We get on really well' },
      { spanish: 'Estamos discutiendo', english: 'We’re arguing' },
      { spanish: 'Hace tiempo que no nos vemos', english: 'It’s been a while since we saw each other' },
      { spanish: 'Cuéntame qué tal', english: 'Tell me how it’s going' },
      { spanish: 'Estoy soltero / soltera', english: 'I’m single' },
      { spanish: 'Llevamos tres años juntos', english: 'We’ve been together three years' },
      { spanish: 'Eres de la familia', english: 'You’re family' },
    ]),
    verbs: [
      { infinitive: 'querer', english: 'to love / want', forms: ['quiero', 'quieres', 'quiere'] },
      { infinitive: 'conocer', english: 'to meet / know', forms: ['conozco', 'conoces', 'conoce'] },
      { infinitive: 'llevarse', english: 'to get on (with)', forms: ['me llevo', 'te llevas', 'se lleva'] },
      { infinitive: 'casarse', english: 'to get married', forms: ['me caso', 'te casas', 'se casa'] },
      { infinitive: 'cuidar', english: 'to look after', forms: ['cuido', 'cuidas', 'cuida'] },
      { infinitive: 'visitar', english: 'to visit', forms: ['visito', 'visitas', 'visita'] },
    ],
  },
  {
    id: 'Technology and modern life',
    emoji: '📱',
    title: 'Technology and Modern Life',
    words: sortBySpanish([
      { spanish: 'el móvil', english: 'mobile phone', definition: 'Smartphone / mobile.', exampleSpanish: 'Se me ha quedado sin batería el móvil.', exampleEnglish: 'My phone has run out of battery.', regional: { spain: 'móvil', argentina: 'celular' } },
      { spanish: 'el ordenador', english: 'computer', definition: 'Computer.', exampleSpanish: 'Trabajo con el ordenador todo el día.', exampleEnglish: 'I work on the computer all day.', regional: { spain: 'ordenador', argentina: 'computadora' } },
      { spanish: 'la contraseña', english: 'password', definition: 'Login password.', exampleSpanish: 'No recuerdo la contraseña.', exampleEnglish: 'I can’t remember the password.' },
      { spanish: 'la aplicación', english: 'app', definition: 'Smartphone app.', exampleSpanish: 'Descargué una aplicación nueva.', exampleEnglish: 'I downloaded a new app.' },
      { spanish: 'la batería', english: 'battery', definition: 'Phone / device battery.', exampleSpanish: 'La batería se agota rápido.', exampleEnglish: 'The battery drains quickly.' },
      { spanish: 'el wifi', english: 'Wi‑Fi', definition: 'Wireless internet.', exampleSpanish: '¿Cuál es la clave del wifi?', exampleEnglish: 'What’s the Wi‑Fi password?' },
      { spanish: 'la pantalla', english: 'screen', definition: 'Display screen.', exampleSpanish: 'La pantalla está rota.', exampleEnglish: 'The screen is broken.' },
      { spanish: 'el cargador', english: 'charger', definition: 'Phone charger.', exampleSpanish: '¿Me prestas el cargador?', exampleEnglish: 'Can I borrow the charger?' },
      { spanish: 'el mensaje', english: 'message', definition: 'Text / chat message.', exampleSpanish: 'Te mandé un mensaje.', exampleEnglish: 'I sent you a message.' },
      { spanish: 'la red social', english: 'social network', definition: 'Social media platform.', exampleSpanish: 'Paso demasiado tiempo en redes sociales.', exampleEnglish: 'I spend too much time on social media.' },
      { spanish: 'el archivo', english: 'file', definition: 'Computer file.', exampleSpanish: 'Adjunta el archivo, por favor.', exampleEnglish: 'Please attach the file.' },
      { spanish: 'la actualización', english: 'update', definition: 'Software update.', exampleSpanish: 'Hay que instalar la actualización.', exampleEnglish: 'You need to install the update.' },
      { spanish: 'el correo', english: 'email / post', definition: 'Email (also postal mail).', exampleSpanish: 'Revisa tu correo.', exampleEnglish: 'Check your email.' },
      { spanish: 'la nube', english: 'cloud (storage)', definition: 'Cloud storage.', exampleSpanish: 'Guardo las fotos en la nube.', exampleEnglish: 'I save photos in the cloud.' },
      { spanish: 'el enlace', english: 'link', definition: 'URL / hyperlink.', exampleSpanish: 'Te paso el enlace.', exampleEnglish: 'I’ll send you the link.' },
      { spanish: 'el teclado', english: 'keyboard', definition: 'Keyboard.', exampleSpanish: 'El teclado es inalámbrico.', exampleEnglish: 'The keyboard is wireless.' },
      { spanish: 'la notificación', english: 'notification', definition: 'App notification.', exampleSpanish: 'Apagué las notificaciones.', exampleEnglish: 'I turned off notifications.' },
      { spanish: 'el usuario', english: 'user', definition: 'Account user.', exampleSpanish: 'Crea un usuario nuevo.', exampleEnglish: 'Create a new user.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Me pasas el wifi?', english: 'Can you give me the Wi‑Fi?' },
      { spanish: 'No tengo cobertura', english: 'I have no signal' },
      { spanish: 'Se me ha colgado', english: 'It’s frozen / crashed' },
      { spanish: 'Te llamo enseguida', english: 'I’ll call you right away' },
      { spanish: '¿Puedes compartirlo?', english: 'Can you share it?' },
      { spanish: 'Estoy sin batería', english: 'I’m out of battery' },
      { spanish: 'Sube la foto a la nube', english: 'Upload the photo to the cloud' },
      { spanish: 'No me llega el mensaje', english: 'I’m not getting the message' },
      { spanish: 'Haz una captura de pantalla', english: 'Take a screenshot' },
      { spanish: 'Hay que reiniciarlo', english: 'You need to restart it' },
    ]),
    verbs: [
      { infinitive: 'descargar', english: 'to download', forms: ['descargo', 'descargas', 'descarga'] },
      { infinitive: 'subir', english: 'to upload / go up', forms: ['subo', 'subes', 'sube'] },
      { infinitive: 'conectar', english: 'to connect', forms: ['conecto', 'conectas', 'conecta'] },
      { infinitive: 'enviar', english: 'to send', forms: ['envío', 'envías', 'envía'] },
      { infinitive: 'guardar', english: 'to save', forms: ['guardo', 'guardas', 'guarda'] },
      { infinitive: 'reiniciar', english: 'to restart', forms: ['reinicio', 'reinicias', 'reinicia'] },
    ],
  },
  {
    id: 'Culture and entertainment',
    emoji: '🎬',
    title: 'Culture and Entertainment',
    words: sortBySpanish([
      { spanish: 'la película', english: 'film / movie', definition: 'Movie.', exampleSpanish: 'Vimos una película excelente.', exampleEnglish: 'We watched an excellent film.' },
      { spanish: 'la serie', english: 'TV series', definition: 'TV show series.', exampleSpanish: 'Estoy viendo una serie española.', exampleEnglish: 'I’m watching a Spanish series.' },
      { spanish: 'el concierto', english: 'concert', definition: 'Live music concert.', exampleSpanish: 'Fuimos a un concierto anoche.', exampleEnglish: 'We went to a concert last night.' },
      { spanish: 'el museo', english: 'museum', definition: 'Museum.', exampleSpanish: 'El museo abre a las diez.', exampleEnglish: 'The museum opens at ten.' },
      { spanish: 'la obra', english: 'play / work of art', definition: 'Theatre play or artwork.', exampleSpanish: 'La obra fue muy emotiva.', exampleEnglish: 'The play was very moving.' },
      { spanish: 'la entrada', english: 'ticket (event)', definition: 'Entry ticket for a show.', exampleSpanish: 'Compré las entradas online.', exampleEnglish: 'I bought the tickets online.' },
      { spanish: 'el actor', english: 'actor', definition: 'Male actor.', exampleSpanish: 'El actor es muy conocido.', exampleEnglish: 'The actor is very well known.' },
      { spanish: 'la canción', english: 'song', definition: 'Song.', exampleSpanish: 'Esta canción me encanta.', exampleEnglish: 'I love this song.' },
      { spanish: 'el festival', english: 'festival', definition: 'Arts / music festival.', exampleSpanish: 'Hay un festival este fin de semana.', exampleEnglish: 'There’s a festival this weekend.' },
      { spanish: 'el escenario', english: 'stage', definition: 'Performance stage.', exampleSpanish: 'Subieron al escenario.', exampleEnglish: 'They went on stage.' },
      { spanish: 'la exposición', english: 'exhibition', definition: 'Art exhibition.', exampleSpanish: 'La exposición termina el domingo.', exampleEnglish: 'The exhibition ends on Sunday.' },
      { spanish: 'el público', english: 'audience', definition: 'Audience / the public.', exampleSpanish: 'El público aplaudió mucho.', exampleEnglish: 'The audience clapped a lot.' },
      { spanish: 'el humor', english: 'humour / mood', definition: 'Comedy or someone’s mood.', exampleSpanish: 'Tiene mucho humor.', exampleEnglish: 'He’s very funny.' },
      { spanish: 'el libro', english: 'book', definition: 'Book.', exampleSpanish: 'Estoy leyendo un libro bueno.', exampleEnglish: 'I’m reading a good book.' },
      { spanish: 'la novela', english: 'novel', definition: 'Novel.', exampleSpanish: 'Es una novela histórica.', exampleEnglish: 'It’s a historical novel.' },
      { spanish: 'el estreno', english: 'premiere / release', definition: 'First showing.', exampleSpanish: 'El estreno es el viernes.', exampleEnglish: 'The premiere is on Friday.' },
      { spanish: 'la crítica', english: 'review', definition: 'Critical review.', exampleSpanish: 'La crítica fue positiva.', exampleEnglish: 'The review was positive.' },
      { spanish: 'el ocio', english: 'leisure', definition: 'Free-time activities.', exampleSpanish: 'Necesito más tiempo de ocio.', exampleEnglish: 'I need more leisure time.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Qué estás viendo?', english: 'What are you watching?' },
      { spanish: '¿Vamos al cine?', english: 'Shall we go to the cinema?' },
      { spanish: 'No me lo pierdo', english: 'I wouldn’t miss it' },
      { spanish: 'Está muy bien valorada', english: 'It’s highly rated' },
      { spanish: 'Me aburrí un poco', english: 'I got a bit bored' },
      { spanish: '¿Has leído algo bueno?', english: 'Have you read anything good?' },
      { spanish: 'Pongamos música', english: 'Let’s put some music on' },
      { spanish: 'Quedó agotado', english: 'It sold out' },
      { spanish: 'Es imperdible', english: 'It’s a must-see' },
      { spanish: '¿De qué va?', english: 'What’s it about?' },
    ]),
    verbs: [
      { infinitive: 'ver', english: 'to watch / see', forms: ['veo', 'ves', 've'] },
      { infinitive: 'escuchar', english: 'to listen', forms: ['escucho', 'escuchas', 'escucha'] },
      { infinitive: 'leer', english: 'to read', forms: ['leo', 'lees', 'lee'] },
      { infinitive: 'bailar', english: 'to dance', forms: ['bailo', 'bailas', 'baila'] },
      { infinitive: 'actuar', english: 'to act / perform', forms: ['actúo', 'actúas', 'actúa'] },
      { infinitive: 'recomendar', english: 'to recommend', forms: ['recomiendo', 'recomiendas', 'recomienda'] },
    ],
  },
  {
    id: 'Shopping and money',
    emoji: '🛍️',
    title: 'Shopping and Money',
    words: sortBySpanish([
      { spanish: 'el precio', english: 'price', definition: 'Cost of something.', exampleSpanish: 'El precio es demasiado alto.', exampleEnglish: 'The price is too high.' },
      { spanish: 'el descuento', english: 'discount', definition: 'Price reduction.', exampleSpanish: 'Hay un descuento del veinte por ciento.', exampleEnglish: 'There’s a twenty percent discount.' },
      { spanish: 'la oferta', english: 'special offer', definition: 'Sale deal.', exampleSpanish: 'Está de oferta.', exampleEnglish: 'It’s on offer.' },
      { spanish: 'la tarjeta', english: 'card', definition: 'Bank / payment card.', exampleSpanish: 'Pago con tarjeta.', exampleEnglish: 'I’ll pay by card.' },
      { spanish: 'el efectivo', english: 'cash', definition: 'Physical money.', exampleSpanish: '¿Aceptan efectivo?', exampleEnglish: 'Do you take cash?' },
      { spanish: 'el cambio', english: 'change / exchange', definition: 'Coins back; also currency exchange.', exampleSpanish: 'Quédese con el cambio.', exampleEnglish: 'Keep the change.' },
      { spanish: 'la talla', english: 'size (clothes)', definition: 'Clothing size.', exampleSpanish: '¿Qué talla usas?', exampleEnglish: 'What size do you wear?' },
      { spanish: 'el escaparate', english: 'shop window', definition: 'Storefront display.', exampleSpanish: 'Vi el abrigo en el escaparate.', exampleEnglish: 'I saw the coat in the window.' },
      { spanish: 'la caja', english: 'till / checkout', definition: 'Cash desk.', exampleSpanish: 'Paga en la caja.', exampleEnglish: 'Pay at the till.' },
      { spanish: 'el recibo', english: 'receipt', definition: 'Proof of purchase.', exampleSpanish: 'Guarda el recibo.', exampleEnglish: 'Keep the receipt.' },
      { spanish: 'la devolución', english: 'return / refund', definition: 'Returning an item.', exampleSpanish: 'Quiero hacer una devolución.', exampleEnglish: 'I want to make a return.' },
      { spanish: 'el presupuesto', english: 'budget', definition: 'Money available to spend.', exampleSpanish: 'No está en mi presupuesto.', exampleEnglish: 'It’s not in my budget.' },
      { spanish: 'el gasto', english: 'expense', definition: 'Money spent.', exampleSpanish: 'Reduje los gastos.', exampleEnglish: 'I cut expenses.' },
      { spanish: 'el ahorro', english: 'savings', definition: 'Money saved.', exampleSpanish: 'Tengo un poco de ahorro.', exampleEnglish: 'I have a bit of savings.' },
      { spanish: 'la moda', english: 'fashion', definition: 'Fashion / trend.', exampleSpanish: 'No sigo mucho la moda.', exampleEnglish: 'I don’t follow fashion much.' },
      { spanish: 'la calidad', english: 'quality', definition: 'How good something is.', exampleSpanish: 'La calidad vale la pena.', exampleEnglish: 'The quality is worth it.' },
      { spanish: 'el centro comercial', english: 'shopping centre', definition: 'Mall.', exampleSpanish: 'Fuimos al centro comercial.', exampleEnglish: 'We went to the shopping centre.' },
      { spanish: 'la cola', english: 'queue', definition: 'Line of people waiting.', exampleSpanish: 'Hay mucha cola.', exampleEnglish: 'There’s a long queue.', regional: { spain: 'cola', argentina: 'fila' } },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Cuánto cuesta?', english: 'How much does it cost?' },
      { spanish: '¿Tienen una talla más grande?', english: 'Do you have a bigger size?' },
      { spanish: 'Solo estoy mirando', english: 'I’m just looking' },
      { spanish: '¿Puedo probarme esto?', english: 'Can I try this on?' },
      { spanish: '¿Hay descuento?', english: 'Is there a discount?' },
      { spanish: 'Me lo llevo', english: 'I’ll take it' },
      { spanish: '¿Se puede devolver?', english: 'Can it be returned?' },
      { spanish: 'Está agotado', english: 'It’s sold out / out of stock' },
      { spanish: 'Pago en efectivo', english: 'I’ll pay in cash' },
      { spanish: '¿Me hace una factura?', english: 'Can you make me an invoice?' },
    ]),
    verbs: [
      { infinitive: 'comprar', english: 'to buy', forms: ['compro', 'compras', 'compra'] },
      { infinitive: 'vender', english: 'to sell', forms: ['vendo', 'vendes', 'vende'] },
      { infinitive: 'pagar', english: 'to pay', forms: ['pago', 'pagas', 'paga'] },
      { infinitive: 'gastar', english: 'to spend', forms: ['gasto', 'gastas', 'gasta'] },
      { infinitive: 'ahorrar', english: 'to save (money)', forms: ['ahorro', 'ahorras', 'ahorra'] },
      { infinitive: 'probarse', english: 'to try on', forms: ['me pruebo', 'te pruebas', 'se prueba'] },
    ],
  },
  {
    id: 'Sport and hobbies',
    emoji: '⚽',
    title: 'Sport and Hobbies',
    words: sortBySpanish([
      { spanish: 'el deporte', english: 'sport', definition: 'Sport in general.', exampleSpanish: 'El deporte me ayuda a desconectar.', exampleEnglish: 'Sport helps me switch off.' },
      { spanish: 'el partido', english: 'match / game', definition: 'Sports match.', exampleSpanish: 'Vimos el partido juntos.', exampleEnglish: 'We watched the match together.' },
      { spanish: 'el equipo', english: 'team', definition: 'Sports team.', exampleSpanish: 'Mi equipo ganó.', exampleEnglish: 'My team won.' },
      { spanish: 'el gol', english: 'goal', definition: 'Goal in football.', exampleSpanish: 'Marcó un gol increíble.', exampleEnglish: 'He scored an incredible goal.' },
      { spanish: 'el entrenamiento', english: 'training', definition: 'Practice session.', exampleSpanish: 'Tengo entrenamiento a las siete.', exampleEnglish: 'I have training at seven.' },
      { spanish: 'la afición', english: 'hobby / fandom', definition: 'Hobby; also sports fans.', exampleSpanish: 'Mi afición es la fotografía.', exampleEnglish: 'My hobby is photography.' },
      { spanish: 'el gimnasio', english: 'gym', definition: 'Fitness gym.', exampleSpanish: 'Voy al gimnasio tres veces por semana.', exampleEnglish: 'I go to the gym three times a week.' },
      { spanish: 'la carrera', english: 'race / running / career', definition: 'Race; also running as activity.', exampleSpanish: 'Corrí una carrera de diez kilómetros.', exampleEnglish: 'I ran a ten-kilometre race.' },
      { spanish: 'el partido amistoso', english: 'friendly match', definition: 'Non-competitive match.', exampleSpanish: 'Jugamos un partido amistoso.', exampleEnglish: 'We played a friendly.' },
      { spanish: 'la victoria', english: 'victory', definition: 'Win.', exampleSpanish: 'Fue una victoria merecida.', exampleEnglish: 'It was a deserved victory.' },
      { spanish: 'la derrota', english: 'defeat', definition: 'Loss.', exampleSpanish: 'Aceptamos la derrota.', exampleEnglish: 'We accepted the defeat.' },
      { spanish: 'el árbitro', english: 'referee', definition: 'Match referee.', exampleSpanish: 'El árbitro pitó falta.', exampleEnglish: 'The referee called a foul.' },
      { spanish: 'la pelota', english: 'ball', definition: 'Ball.', exampleSpanish: 'Pásame la pelota.', exampleEnglish: 'Pass me the ball.' },
      { spanish: 'el ocio', english: 'leisure', definition: 'Free time.', exampleSpanish: 'En mi ocio leo y corro.', exampleEnglish: 'In my free time I read and run.' },
      { spanish: 'el pasatiempo', english: 'pastime / hobby', definition: 'Hobby.', exampleSpanish: 'La pintura es mi pasatiempo.', exampleEnglish: 'Painting is my pastime.' },
      { spanish: 'la competición', english: 'competition', definition: 'Competitive event.', exampleSpanish: 'Participo en una competición.', exampleEnglish: 'I’m taking part in a competition.' },
      { spanish: 'el marcador', english: 'scoreboard / score', definition: 'Score.', exampleSpanish: 'El marcador está empatado.', exampleEnglish: 'The score is tied.' },
      { spanish: 'la lesión', english: 'injury', definition: 'Sports injury.', exampleSpanish: 'Tuve una lesión en la rodilla.', exampleEnglish: 'I had a knee injury.' },
    ]),
    phrases: sortBySpanish([
      { spanish: '¿Practicas algún deporte?', english: 'Do you play any sport?' },
      { spanish: 'Soy del Madrid / del Barça', english: 'I support Madrid / Barça' },
      { spanish: '¡Qué partidazo!', english: 'What a match!' },
      { spanish: 'Estoy fuera de forma', english: 'I’m out of shape' },
      { spanish: 'Vamos a entrenar', english: 'Let’s go train' },
      { spanish: 'Empataron a dos', english: 'They drew two-all' },
      { spanish: 'No pude ir al gimnasio', english: 'I couldn’t go to the gym' },
      { spanish: 'Es mi hobby favorito', english: 'It’s my favourite hobby' },
      { spanish: 'Jugamos el domingo', english: 'We’re playing on Sunday' },
      { spanish: 'Me duele después del partido', english: 'I ache after the match' },
    ]),
    verbs: [
      { infinitive: 'jugar', english: 'to play', forms: ['juego', 'juegas', 'juega'] },
      { infinitive: 'correr', english: 'to run', forms: ['corro', 'corres', 'corre'] },
      { infinitive: 'ganar', english: 'to win', forms: ['gano', 'ganas', 'gana'] },
      { infinitive: 'perder', english: 'to lose', forms: ['pierdo', 'pierdes', 'pierde'] },
      { infinitive: 'entrenar', english: 'to train', forms: ['entreno', 'entrenas', 'entrena'] },
      { infinitive: 'marcar', english: 'to score', forms: ['marco', 'marcas', 'marca'] },
    ],
  },
].map((theme) => ({
  ...theme,
  id: theme.id as VocabTheme,
  words: sortBySpanish(theme.words),
  phrases: sortBySpanish(theme.phrases),
  verbs: [...theme.verbs].sort((a, b) => a.infinitive.localeCompare(b.infinitive, 'es')),
})) as ThemedVocabularyTheme[];

export const THEME_EMOJI: Record<VocabTheme, string> = Object.fromEntries(
  THEMED_VOCABULARY.map((t) => [t.id, t.emoji]),
) as Record<VocabTheme, string>;

export function normalizeSpanishKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(el|la|los|las|un|una)\s+/, '');
}

export function findThemeById(id: string): ThemedVocabularyTheme | undefined {
  const lower = id.trim().toLowerCase();
  return THEMED_VOCABULARY.find((t) => t.id.toLowerCase() === lower || t.title.toLowerCase() === lower);
}

export function getAllThemeIds(): VocabTheme[] {
  return [...VOCAB_THEMES];
}
