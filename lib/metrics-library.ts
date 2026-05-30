export type MetricCategory =
  | 'recovery'
  | 'sleep'
  | 'nutrition'
  | 'body'
  | 'activity'

export interface MetricDefinition {
  slug:              string
  title:             string
  category:          MetricCategory
  units:             string | null
  short_description: string
  full_explanation:  string
  how_measured:      string
  why_track_it:      string
  typical_examples:  string
  limitations:       string
  related_metrics:   string[]   // slugs
}

export const METRICS: MetricDefinition[] = [
  // ── Recovery & Heart ────────────────────────────────────────────────────────
  {
    slug: 'hrv',
    title: 'HRV',
    category: 'recovery',
    units: 'ms (milliseconds)',
    short_description: 'Measures variation in time between consecutive heartbeats.',
    full_explanation:
      'HRV stands for Heart Rate Variability. Although the heart appears to beat at a steady rhythm, the time between individual beats varies from one moment to the next. One beat might follow the previous after 920 milliseconds, the next after 980 ms, and the next after 950 ms. HRV measures these small variations.\n\nA higher HRV generally indicates that the body\'s autonomic nervous system — which controls automatic functions like breathing, digestion, and heart rhythm — is in a balanced, flexible state. A lower HRV can reflect that the system is under stress, whether from hard exercise, insufficient sleep, illness, or psychological pressure.',
    how_measured:
      'HRV is calculated from the time gaps between heartbeats, known as RR intervals. Consumer devices like smartwatches, fitness trackers, and chest heart rate straps capture these intervals using optical sensors or ECG electrodes and then calculate a HRV score, most commonly using the RMSSD method (Root Mean Square of Successive Differences).',
    why_track_it:
      'Tracking HRV over time helps reveal patterns in how well your body is recovering. Many athletes and health-conscious individuals use daily HRV readings to decide whether to train hard, take it easy, or rest. It can also help detect early signs of overtraining or illness before symptoms become obvious.',
    typical_examples:
      'HRV values vary widely between individuals and cannot be meaningfully compared person-to-person. A person might have a healthy baseline of 45 ms while another has a baseline of 90 ms — both can be normal for that individual. What matters is how your own reading compares to your recent personal average.',
    limitations:
      'HRV is highly individual — comparisons between people are not meaningful. It is influenced by many factors including body position, time of day, alcohol consumption, and measurement method. A single low reading is rarely significant; trends over days and weeks matter far more.',
    related_metrics: ['resting-heart-rate', 'recovery', 'sleep'],
  },

  {
    slug: 'resting-heart-rate',
    title: 'Resting Heart Rate',
    category: 'recovery',
    units: 'bpm (beats per minute)',
    short_description: 'How many times the heart beats per minute at rest.',
    full_explanation:
      'Resting Heart Rate (RHR) is the number of times your heart beats per minute when your body is at complete rest — typically measured first thing in the morning before getting up.\n\nThe heart muscle needs to pump blood continuously to supply oxygen and nutrients throughout the body. At rest, it does this with minimal demand, so a lower RHR indicates the heart is pumping efficiently with each beat. Cardiovascular fitness tends to lower RHR over time because a conditioned heart pumps more blood per beat.',
    how_measured:
      'Consumer devices measure RHR using optical sensors on the wrist or finger that detect blood flow. Medical-grade measurement uses an ECG. Most wearables calculate RHR during the lowest activity period of sleep.',
    why_track_it:
      'RHR is a simple indicator of cardiovascular health and recovery state. An elevated RHR compared to your personal baseline can signal that your body is under stress — from intense training, poor sleep, illness, or dehydration. Tracking RHR trends can help you catch these signals before they become problems.',
    typical_examples:
      'For most adults, resting heart rate falls between 60 and 100 bpm. Well-trained endurance athletes often have resting heart rates between 40 and 60 bpm. Values consistently above 100 bpm may warrant medical attention.',
    limitations:
      'RHR varies based on hydration, stress, caffeine, medications, and age. Wrist-based optical sensors are generally less accurate than chest ECG straps. A single elevated reading is rarely cause for concern — the trend over days matters more.',
    related_metrics: ['hrv', 'recovery', 'sleep'],
  },

  {
    slug: 'heart-rate',
    title: 'Heart Rate',
    category: 'recovery',
    units: 'bpm (beats per minute)',
    short_description: 'Number of heartbeats per minute during activity or at rest.',
    full_explanation:
      'Heart rate is the number of times the heart contracts (beats) per minute. During physical activity, the muscles demand more oxygen, so the heart speeds up to deliver more oxygenated blood. Heart rate during exercise is used to gauge effort intensity.\n\nHeart rate zones — ranging from easy/aerobic to high-intensity — help people train at appropriate intensities for different goals. Lower zones build aerobic base; higher zones improve speed and power but require more recovery.',
    how_measured:
      'Heart rate is measured by optical sensors in wearables (which detect blood volume changes under the skin) or by electrical ECG sensors in chest straps. Chest straps are generally more accurate, especially during high-intensity exercise.',
    why_track_it:
      'Tracking heart rate during exercise helps ensure you are training at the right intensity for your goal — not too easy to produce adaptation, not too hard to recover from properly. Over time, seeing the same pace or power at a lower heart rate indicates improving fitness.',
    typical_examples:
      'Maximum heart rate is roughly 220 minus your age, though this is a rough estimate. Zone 2 (aerobic base) is typically 60–70% of max. Zone 4–5 (high intensity) is 85–100% of max.',
    limitations:
      'Wrist optical heart rate tracking can be inaccurate during high-intensity exercise or activities with a lot of wrist movement. Maximum heart rate estimates from formulas vary significantly between individuals.',
    related_metrics: ['resting-heart-rate', 'hrv', 'training-load', 'vo2-max'],
  },

  {
    slug: 'recovery',
    title: 'Recovery',
    category: 'recovery',
    units: 'Score (0–100)',
    short_description: 'A composite score reflecting how well the body has recovered.',
    full_explanation:
      'Recovery, as shown in KeepGoing, is a calculated score that combines multiple signals — HRV, resting heart rate, and sleep — to produce a single number indicating how ready your body is for demanding activity.\n\nWhen the body is well recovered, these metrics tend to align: HRV is at or above baseline, RHR is at or below baseline, and sleep was adequate. When recovery is poor, one or more of these signals is suppressed.',
    how_measured:
      'KeepGoing computes a recovery score by comparing today\'s HRV and resting heart rate to recent personal baselines and by evaluating sleep duration. The result is a 0–100 score, colour-coded green, yellow, or red.',
    why_track_it:
      'Recovery scores help you make smarter training decisions. Going hard when recovery is low increases the risk of injury, illness, or stagnation. Going easy when recovery is high means you may be leaving adaptation on the table.',
    typical_examples:
      'A score above 70 generally suggests a good day for training. Scores between 40–70 indicate moderate readiness — lighter activity is appropriate. Below 40 suggests rest or very low-intensity activity.',
    limitations:
      'The score depends on the quality of the underlying metrics — it is only as accurate as your HRV and sleep data. It is a guide, not a prescription. Other factors like motivation, nutrition timing, and life stress are not captured.',
    related_metrics: ['hrv', 'resting-heart-rate', 'sleep', 'training-load'],
  },

  // ── Sleep ────────────────────────────────────────────────────────────────────
  {
    slug: 'sleep',
    title: 'Sleep',
    category: 'sleep',
    units: 'Hours (h)',
    short_description: 'Total time spent asleep per night.',
    full_explanation:
      'Sleep is the body\'s primary recovery mechanism. During sleep, the body repairs muscle tissue, consolidates memories, regulates hormones, and clears metabolic waste from the brain. The total duration of sleep each night is one of the most powerful determinants of health, performance, and recovery.\n\nSleep is divided into cycles of roughly 90 minutes, each containing multiple stages: light sleep, deep sleep (also called slow-wave sleep), and REM (Rapid Eye Movement) sleep. Getting enough total sleep ensures the body has time to complete multiple cycles and sufficient time in each stage.',
    how_measured:
      'Consumer wearables track sleep using a combination of movement sensors (accelerometers) and heart rate monitoring to detect when you are asleep and estimate sleep stages. The results are an approximation — clinical sleep studies using brain-wave measurement (polysomnography) are far more accurate.',
    why_track_it:
      'Chronic sleep restriction — even mild, like consistently sleeping 6 hours instead of 8 — has measurable negative effects on cognitive function, mood, immune function, appetite regulation, and athletic performance. Tracking sleep helps identify whether poor recovery, low energy, or underperformance might have a sleep-related cause.',
    typical_examples:
      'Most adults function best with 7–9 hours per night. Athletes often benefit from 8–10 hours due to higher recovery demands. Teenagers need 8–10 hours. Consistently sleeping under 6 hours is associated with increased health risks over time.',
    limitations:
      'Consumer wearables overestimate sleep duration compared to clinical measurement. Sleep quality matters as much as quantity — 8 hours of fragmented sleep is not equivalent to 8 hours of consolidated sleep. Sleep needs vary significantly between individuals.',
    related_metrics: ['deep-sleep', 'rem-sleep', 'hrv', 'recovery'],
  },

  {
    slug: 'deep-sleep',
    title: 'Deep Sleep',
    category: 'sleep',
    units: 'Hours or Minutes',
    short_description: 'The most physically restorative stage of sleep.',
    full_explanation:
      'Deep sleep, also called slow-wave sleep (SWS) or stage 3 non-REM sleep, is the most physically restorative phase of the sleep cycle. During deep sleep, heart rate and breathing slow to their lowest rates, brain waves become large and slow, and the body releases the majority of its growth hormone.\n\nThis is the stage when physical repair happens most actively — muscle tissue damaged by exercise is rebuilt, the immune system is strengthened, and metabolic waste is cleared from tissues. Deep sleep is concentrated in the earlier part of the night.',
    how_measured:
      'Wearables estimate deep sleep using heart rate variability and movement data. Clinical measurement uses electroencephalography (EEG) to detect the characteristic slow, high-amplitude brain waves of deep sleep.',
    why_track_it:
      'Insufficient deep sleep impairs physical recovery and immune function. Athletes who regularly fall short on deep sleep may find they are slower to recover from hard training sessions.',
    typical_examples:
      'Adults typically spend 15–25% of total sleep time in deep sleep, roughly 1–2 hours for an 8-hour night. Deep sleep decreases with age. Alcohol is known to suppress deep sleep.',
    limitations:
      'Wearable estimates of deep sleep are rough approximations. Alcohol, sleep disorders, and temperature can shift the proportion of deep sleep. Consumer devices often misclassify stages.',
    related_metrics: ['sleep', 'rem-sleep', 'recovery', 'hrv'],
  },

  {
    slug: 'rem-sleep',
    title: 'REM Sleep',
    category: 'sleep',
    units: 'Hours or Minutes',
    short_description: 'The mentally restorative stage of sleep where dreaming occurs.',
    full_explanation:
      'REM (Rapid Eye Movement) sleep is the stage most associated with dreaming. During REM, the brain is highly active — almost as active as during waking — while the body\'s large muscle groups are temporarily paralysed to prevent acting out dreams.\n\nREM sleep plays a critical role in emotional regulation, memory consolidation, learning, and creativity. Skills and information learned during the day are processed and stored during REM sleep. REM cycles become longer as the night progresses, meaning the final hours of sleep contain the most REM.',
    how_measured:
      'Wearables estimate REM using movement and heart rate variability — during REM, heart rate becomes more irregular and movement is minimal. EEG (brain-wave monitoring) is required for accurate measurement.',
    why_track_it:
      'Cutting sleep short — for example with an alarm — disproportionately reduces REM sleep, since it occurs mostly in the later sleep cycles. This can impair mood, decision-making, and skill retention the following day.',
    typical_examples:
      'Adults typically spend 20–25% of total sleep time in REM, roughly 1.5–2 hours for an 8-hour night. Sleep deprivation causes REM rebound — the body compensates with more REM on recovery nights.',
    limitations:
      'Wearable REM detection is less reliable than deep sleep detection. Medications, alcohol, and certain supplements can suppress REM. Individual needs vary.',
    related_metrics: ['sleep', 'deep-sleep', 'recovery'],
  },

  // ── Nutrition ────────────────────────────────────────────────────────────────
  {
    slug: 'calorie-balance',
    title: 'Calorie Balance',
    category: 'nutrition',
    units: 'kcal (kilocalories)',
    short_description: 'The difference between calories consumed and calories burned.',
    full_explanation:
      'Calorie balance is the difference between the energy you take in through food and the energy your body expends. A negative balance (deficit) means you are burning more than you eat, which generally leads to body fat loss over time. A positive balance (surplus) means you are eating more than you burn, which generally leads to weight gain.\n\nCalorie balance is calculated as: Consumed − (Active Energy + Resting Energy). This number is not a precise measurement — it is an estimate based on approximations of both intake and expenditure.',
    how_measured:
      'Calories consumed are estimated from food log entries. Calories burned are the sum of active energy (movement and exercise) and resting energy (what the body burns to maintain basic functions), both sourced from Apple Health or similar tracking services.',
    why_track_it:
      'Calorie balance is a useful tool for understanding the relationship between eating, activity, and body weight. Tracking it over multiple days reveals trends that a single day cannot show. Sustained large deficits can impair recovery; sustained large surpluses lead to unwanted fat gain.',
    typical_examples:
      'A moderate deficit of 300–500 kcal/day is generally considered sustainable for fat loss while preserving muscle. A deficit larger than 700–800 kcal/day may impair performance and recovery. Balanced days (within ±200 kcal) are appropriate during maintenance phases.',
    limitations:
      'Calorie estimates from food logs are approximate — restaurant meals and home-cooked food are notoriously hard to track accurately. Active and resting energy from wearables also carry a margin of error of 10–20%. Use as a directional trend, not a precise measurement.',
    related_metrics: ['active-energy', 'resting-energy', 'protein', 'weight'],
  },

  {
    slug: 'active-energy',
    title: 'Active Energy',
    category: 'nutrition',
    units: 'kcal (kilocalories)',
    short_description: 'Calories burned through movement and exercise.',
    full_explanation:
      'Active energy is the calories burned through physical movement — walking, cycling, running, exercise sessions, and any other non-resting activity throughout the day. It is distinct from resting energy, which the body expends automatically regardless of activity.\n\nActive energy is sometimes called Exercise Activity Thermogenesis (EAT) or Non-Exercise Activity Thermogenesis (NEAT), depending on whether the movement is structured exercise or incidental daily movement like walking to the kitchen or fidgeting.',
    how_measured:
      'Wearables and smartphones estimate active energy using accelerometers, GPS, and heart rate data. Apple Health combines data from the device and linked apps to produce a daily active energy total.',
    why_track_it:
      'Active energy is the portion of energy expenditure most under your control — adding movement increases it, reducing movement decreases it. Understanding how different activities affect active energy can help calibrate training and eating.',
    typical_examples:
      'A sedentary day might see 200–400 kcal of active energy. A 90-minute moderate bike ride might add 700–1000 kcal. A day with lots of incidental walking adds 400–600 kcal even without formal exercise.',
    limitations:
      'Wearable active energy estimates carry significant error, especially for activities like strength training and cycling where wrist movement does not correlate well with actual effort. Estimates can vary 15–25% from actual expenditure.',
    related_metrics: ['resting-energy', 'calorie-balance', 'training-load', 'steps'],
  },

  {
    slug: 'resting-energy',
    title: 'Resting Energy',
    category: 'nutrition',
    units: 'kcal (kilocalories)',
    short_description: 'Calories burned at rest to maintain basic bodily functions.',
    full_explanation:
      'Resting energy — sometimes called Basal Metabolic Rate (BMR) or Resting Metabolic Rate (RMR) — is the number of calories the body burns each day just to maintain basic functions: breathing, pumping blood, maintaining organ function, regulating temperature, and supporting cellular processes. This happens even during sleep.\n\nResting energy typically accounts for the majority of total daily calorie expenditure — usually 60–75% for a moderately active person.',
    how_measured:
      'Medical measurement uses indirect calorimetry — measuring oxygen consumption and CO₂ production at rest. Consumer devices estimate resting energy from age, sex, height, weight, and heart rate data.',
    why_track_it:
      'Understanding resting energy helps calibrate total calorie targets. Someone with a higher resting energy needs more total food to maintain weight. Resting energy is relatively stable day to day but declines with age and can change with significant weight loss.',
    typical_examples:
      'Resting energy for an average adult falls between 1,200 and 2,000 kcal/day, varying significantly with body size and composition. Larger people with more muscle mass have higher resting energy.',
    limitations:
      'Consumer device estimates of resting energy are based on population averages and may not reflect individual metabolic differences accurately. Significant deviations from estimated resting energy can occur with thyroid conditions and other metabolic factors.',
    related_metrics: ['active-energy', 'calorie-balance'],
  },

  {
    slug: 'protein',
    title: 'Protein',
    category: 'nutrition',
    units: 'g (grams)',
    short_description: 'Daily protein intake tracked from food logs.',
    full_explanation:
      'Protein is one of the three macronutrients (alongside carbohydrates and fat) and is the primary building material for muscle, connective tissue, enzymes, hormones, and immune system components. Unlike carbohydrates and fat, the body does not store protein — what it cannot use is either excreted or converted to energy.\n\nAfter exercise, especially resistance training, the muscles are damaged and need amino acids (the building blocks of protein) to repair and grow. Eating adequate protein supports this repair process and helps preserve muscle mass, especially during periods of calorie restriction.',
    how_measured:
      'Protein intake is estimated from food log entries in the app. Each food log entry includes an estimated protein value in grams, which is summed across all meals logged for the day.',
    why_track_it:
      'Protein is commonly under-consumed relative to what active people need for recovery and muscle maintenance. Tracking protein gives a clear signal of whether daily needs are likely being met, especially important during calorie deficits when muscle preservation requires extra attention.',
    typical_examples:
      'Current sports nutrition guidelines generally recommend 1.4–2.0 g of protein per kg of body weight per day for active people. For a person weighing 80 kg, that is 112–160 g/day. Distributing intake across meals (rather than in one large dose) improves utilization.',
    limitations:
      'Food log protein values are estimates — different sources vary in actual protein content. Bioavailability (how much protein is actually absorbed and used) also varies between protein sources, though most whole food sources are well absorbed.',
    related_metrics: ['protein-target', 'calorie-balance', 'weight'],
  },

  {
    slug: 'protein-target',
    title: 'Protein Target',
    category: 'nutrition',
    units: 'g (grams)',
    short_description: 'Your personalised daily protein goal based on body weight.',
    full_explanation:
      'Protein target is the amount of protein per day that matches your personal needs, calculated from your current body weight and a target intake per kilogram. In KeepGoing, if a protein rate has been set in your health profile (such as 1.6 g per kg), the app multiplies this by your latest logged weight to produce your daily protein target.\n\nThis personalised approach accounts for the fact that protein needs scale with body size — a heavier person needs more protein in absolute terms than a lighter person, even at the same intake per kilogram.',
    how_measured:
      'The target is computed as: protein rate (g/kg) × current body weight (kg). The protein rate and weight are sourced from your health profile and your most recent weight log respectively.',
    why_track_it:
      'A fixed protein target in grams takes the guesswork out of daily protein tracking. Rather than checking whether you consumed enough grams in general, you have a specific number calibrated to your body.',
    typical_examples:
      'For a person weighing 88 kg using 1.6 g/kg as their protein rate, the target would be 141 g/day. Hitting this consistently across days — not just on average — is what matters for recovery and muscle preservation.',
    limitations:
      'Protein rate targets are evidence-based ranges, not exact prescriptions. The optimal rate varies based on training type, age, and goals. A 1.6 g/kg target may be appropriate for moderate endurance training but may need to be higher during aggressive calorie restriction.',
    related_metrics: ['protein', 'weight', 'calorie-balance'],
  },

  {
    slug: 'caffeine',
    title: 'Caffeine',
    category: 'nutrition',
    units: 'mg (milligrams)',
    short_description: 'Total caffeine consumed today from tracked coffee.',
    full_explanation:
      'Caffeine is a stimulant found naturally in coffee, tea, and cacao. It works by blocking adenosine receptors in the brain — adenosine is a chemical that accumulates during wakefulness and promotes sleepiness. By blocking these receptors, caffeine temporarily reduces feelings of fatigue and increases alertness.\n\nIn KeepGoing, caffeine is tracked from logged coffee entries. Each coffee type has an estimated caffeine content based on standard preparation methods.',
    how_measured:
      'Caffeine is calculated from the coffee entries logged in the Coffee section. Each recipe type (filter, espresso, etc.) has a standard caffeine estimate. Custom filter volumes are calculated proportionally.',
    why_track_it:
      'Caffeine has a half-life of approximately 5–6 hours, meaning half of the caffeine consumed at 2pm is still in your system at 8pm. Tracking total daily caffeine and the timing of the last coffee can help identify whether caffeine is likely to be disrupting sleep onset or quality.',
    typical_examples:
      'A typical espresso shot contains 60–80 mg of caffeine. A 225 ml filter coffee contains roughly 135–180 mg. The general recommended upper limit for healthy adults is around 400 mg per day, though sensitivity varies widely between individuals.',
    limitations:
      'Actual caffeine content varies significantly based on coffee bean variety, roast level, grind size, and brew time. The estimates used in KeepGoing are averages for common preparation methods. Caffeine sensitivity also varies greatly between individuals based on genetics and tolerance.',
    related_metrics: ['sleep', 'recovery'],
  },

  // ── Body ─────────────────────────────────────────────────────────────────────
  {
    slug: 'weight',
    title: 'Weight',
    category: 'body',
    units: 'kg (kilograms)',
    short_description: 'Body weight measured at a consistent point in time.',
    full_explanation:
      'Body weight is total mass measured on a scale. It includes all components of the body — fat, muscle, bone, organs, water, and the contents of the digestive system. For this reason, raw daily weight can fluctuate by 1–3 kg or more even when nothing meaningful has changed in body composition.\n\nFor meaningful tracking, consistency matters most: same time of day (ideally first thing in the morning after using the bathroom), same amount of clothing, and preferably the same scale.',
    how_measured:
      'Standard bathroom scales measure weight. More advanced scales use bioelectrical impedance to estimate body composition (fat vs. lean mass), though these estimates vary in accuracy.',
    why_track_it:
      'Tracking weight over time — with proper context — is useful for monitoring broad trends in body composition. Weekly averages are more informative than individual daily readings, which fluctuate too much to be meaningful in isolation.',
    typical_examples:
      'Daily weight can legitimately vary by 1–3 kg due to food intake, hydration, sodium, hormonal cycles, and bowel habits. A meaningful change in body fat takes weeks to register clearly in scale weight.',
    limitations:
      'Scale weight does not distinguish between fat mass, muscle mass, water, and food in the digestive system. Focusing too heavily on daily readings can be misleading — the 7-day moving average is a far more reliable signal.',
    related_metrics: ['weight-trend', 'protein', 'calorie-balance'],
  },

  {
    slug: 'weight-trend',
    title: 'Weight Trend',
    category: 'body',
    units: 'kg (kilograms)',
    short_description: 'Smoothed average weight over 7 days, filtering out daily noise.',
    full_explanation:
      'Weight trend is a moving average — typically over 7 days — that smooths out the natural daily fluctuations in scale weight to reveal the underlying direction of change. Where a raw weight reading on any given morning might be inflated by yesterday\'s dinner or deflated by dehydration, the 7-day moving average shows what is actually happening to body mass over time.\n\nThe trend line is the signal. The daily reading is just one data point of noise within it.',
    how_measured:
      'KeepGoing calculates a 7-day moving average by averaging the current day\'s weight with the preceding 6 days. It is displayed as a line on the weight chart, alongside individual daily readings.',
    why_track_it:
      'Following the trend rather than individual readings removes the emotional volatility of daily weight tracking. When the trend is moving in the right direction, it is working — even if today\'s reading is up from yesterday.',
    typical_examples:
      'If your daily weights for the past 7 days were 88.2, 87.8, 88.5, 87.6, 88.1, 87.9, 88.0 kg — the 7-day average would be 88.0 kg. The trend number is more meaningful than any single morning reading.',
    limitations:
      'A 7-day average still takes 1–2 weeks to clearly reflect a change in direction. Longer windows (14 or 28 days) are smoother but slower to respond.',
    related_metrics: ['weight', 'calorie-balance'],
  },

  {
    slug: 'steps',
    title: 'Steps',
    category: 'body',
    units: 'steps',
    short_description: 'Total number of steps taken in a day.',
    full_explanation:
      'Step count measures the total number of steps taken throughout the day, captured automatically by the accelerometer in a phone or wearable. It is a proxy for overall daily movement and Non-Exercise Activity Thermogenesis (NEAT) — the calories burned through all activity outside of formal exercise.\n\nNEAT varies enormously between people — someone who walks a lot throughout the day burns significantly more calories than someone who sits most of the day, even if both do the same formal workout.',
    how_measured:
      'Accelerometers in smartphones and wearables detect the characteristic pattern of walking movement and count steps. GPS is used in some devices to validate step counts against distance covered.',
    why_track_it:
      'Steps are one of the easiest ways to quantify daily movement. Research consistently shows that higher daily step counts are associated with better health outcomes independent of structured exercise. On low-activity days, step count also contributes meaningfully to active energy burn.',
    typical_examples:
      '10,000 steps per day is a commonly cited target, though any increase from a low baseline has health benefits. 7,000–8,000 steps is associated with significant health benefits in research. A sedentary desk day might produce only 3,000–5,000 steps.',
    limitations:
      'Step counters are imperfect — some activities (cycling, swimming) generate few steps despite significant calorie expenditure. Wrist-based trackers can miscount steps during activities with similar arm movements to walking.',
    related_metrics: ['active-energy', 'training-load'],
  },

  // ── Activity & Performance ────────────────────────────────────────────────────
  {
    slug: 'vo2-max',
    title: 'VO₂ Max',
    category: 'activity',
    units: 'mL/kg/min',
    short_description: 'Maximum rate at which the body can consume oxygen during exercise.',
    full_explanation:
      'VO₂ Max is the maximum volume of oxygen the body can consume per kilogram of body weight per minute during intense exercise. It represents the ceiling of the cardiovascular and muscular systems\' ability to extract and use oxygen to produce energy.\n\nVO₂ Max is considered one of the strongest predictors of endurance performance and long-term health. Higher VO₂ Max values mean the body can sustain harder efforts aerobically for longer, and research links higher VO₂ Max with lower risk of cardiovascular disease, diabetes, and all-cause mortality.',
    how_measured:
      'Laboratory measurement uses a graded exercise test on a treadmill or cycling ergometer with a metabolic analyzer measuring exhaled gas. Consumer wearables estimate VO₂ Max from heart rate response to exercise using algorithms that compare heart rate to measured effort.',
    why_track_it:
      'VO₂ Max is a useful long-term fitness indicator. Seeing it increase over months of training confirms that cardiovascular fitness is improving. It also provides a useful benchmark for comparing fitness across different points in life.',
    typical_examples:
      'Untrained adults typically fall in the 30–45 mL/kg/min range. Recreational athletes often sit between 45–60 mL/kg/min. Elite endurance athletes can exceed 70 mL/kg/min. VO₂ Max decreases about 1% per year after age 25 without training.',
    limitations:
      'Consumer wearable estimates of VO₂ Max are algorithmic approximations, not laboratory measurements. They require sufficient running or cycling data to produce estimates. Estimates vary between devices and manufacturers.',
    related_metrics: ['heart-rate', 'training-load', 'recovery'],
  },

  {
    slug: 'training-load',
    title: 'Training Load',
    category: 'activity',
    units: 'Minutes of activity',
    short_description: 'Total volume of training accumulated over a period.',
    full_explanation:
      'Training load refers to the cumulative amount of physical work the body has performed over a given time period. In KeepGoing, it is represented as total activity minutes over the current week.\n\nAt a broader level, training load is the product of training volume (how much) and training intensity (how hard). Managing load — gradually increasing it while allowing adequate recovery — is the foundation of progressive fitness development and injury prevention.',
    how_measured:
      'KeepGoing sums the duration of all logged activities for the current week (Monday to Sunday). More sophisticated training load calculations multiply duration by intensity (e.g., using heart rate zones or power) to weight hard sessions more heavily than easy ones.',
    why_track_it:
      'Understanding your training load helps avoid both undertraining (too little stimulus to improve) and overreaching (too much load relative to recovery capacity). A rapid spike in load — increasing volume by more than 10% week to week — is a risk factor for injury.',
    typical_examples:
      'A recreational athlete might sustain 4–6 hours (240–360 min) of weekly training across multiple sessions. Elite athletes often train 10–20+ hours per week. What matters is whether the load is appropriate for your current fitness level and how well it is distributed across the week.',
    limitations:
      'Duration alone does not capture intensity — 30 minutes of hard intervals is very different from 30 minutes of easy walking. KeepGoing does not yet apply intensity weighting to the load calculation.',
    related_metrics: ['recovery', 'hrv', 'duration', 'active-energy'],
  },

  {
    slug: 'distance',
    title: 'Distance',
    category: 'activity',
    units: 'km (kilometres)',
    short_description: 'Total distance covered during an activity.',
    full_explanation:
      'Distance measures how far you travelled during an activity — running, cycling, hiking, or any other locomotion-based sport. It is one of the most intuitive measures of workout volume, alongside duration.\n\nFor cycling, distance correlates more loosely with physiological load than for running, because wind, gradient, and power output affect how hard a given distance is. For running, pace (time per kilometre) combined with distance gives a good sense of load.',
    how_measured:
      'Distance is measured by GPS in the activity device (watch, phone, cycling computer). GPS accuracy is affected by satellite signal availability — dense urban environments and heavy cloud cover can reduce accuracy.',
    why_track_it:
      'Tracking cumulative distance over weeks and months reveals training volume trends. It is also useful for goal-setting — training toward a specific event distance — and for understanding how activity translates to energy expenditure.',
    typical_examples:
      'A typical training ride might cover 40–80 km. A recovery ride might be 20–30 km. A marathon is 42.2 km of running. Cycling distances are typically much higher than running distances at comparable effort and duration.',
    limitations:
      'Distance is a measure of quantity, not quality. A flat 60 km ride is very different from a hilly 60 km ride. GPS recording has inherent error — particularly on tight corners, under tree cover, or in urban canyons.',
    related_metrics: ['duration', 'pace', 'speed', 'elevation-gain'],
  },

  {
    slug: 'duration',
    title: 'Duration',
    category: 'activity',
    units: 'hours and minutes',
    short_description: 'Total time of an activity from start to finish.',
    full_explanation:
      'Duration is simply the elapsed time of an activity — from the moment it starts to the moment it ends. It is the most universal measure of training volume, applicable to any type of exercise regardless of whether distance is tracked.\n\nDuration is particularly useful for comparing sessions across different activity types (a 60-minute swim versus a 60-minute run) where distance is not directly comparable.',
    how_measured:
      'Duration is recorded from the start and stop times of the activity as logged in the tracking device or entered manually in KeepGoing.',
    why_track_it:
      'Duration is the simplest proxy for training load. Summing weekly duration across all sessions gives a clear picture of total training volume. Trends in weekly duration over time reveal whether training load is increasing, stable, or decreasing.',
    typical_examples:
      'A morning run might last 30–45 minutes. An endurance ride could last 2–4 hours. Strength sessions typically run 45–75 minutes. Recovery activities like yoga or walking might be 30–60 minutes.',
    limitations:
      'Duration does not capture intensity — a 60-minute Zone 2 ride creates very different physiological stress than a 60-minute hard interval session, even though duration is the same.',
    related_metrics: ['training-load', 'distance', 'average-power'],
  },

  {
    slug: 'average-power',
    title: 'Average Power',
    category: 'activity',
    units: 'W (Watts)',
    short_description: 'Mean power output sustained throughout a cycling activity.',
    full_explanation:
      'Power in cycling is a direct measurement of the mechanical work being done — how many watts the rider is producing through the pedals. Average power is the mean of all power readings recorded throughout a ride.\n\nUnlike heart rate or speed, power is an instantaneous measure of effort that is unaffected by wind, terrain, or fatigue response lag. It is the gold standard for measuring cycling intensity and is used to calculate metrics like Training Stress Score and Intensity Factor.',
    how_measured:
      'Power is measured by a power meter — a strain gauge device that measures the torque (force) applied to the pedals, chainrings, or rear hub, combined with cadence (pedal rotation speed). Power = Force × Velocity.',
    why_track_it:
      'Average power, combined with duration, gives a precise measure of the physiological load of a cycling session. Comparing average power to FTP (Functional Threshold Power) reveals how hard an effort was relative to your maximum sustainable effort.',
    typical_examples:
      'A recreational cyclist\'s average power might be 150–200W for a moderate ride. FTP values for trained riders typically range from 200–350W. Professional cyclists produce 380–450W at threshold during a race.',
    limitations:
      'Average power can be misleading if the ride has long coasting periods — for example on a descent — which dilute the average without reflecting actual effort. Normalized Power addresses this limitation.',
    related_metrics: ['normalized-power', 'cadence', 'duration', 'training-load'],
  },

  {
    slug: 'normalized-power',
    title: 'Normalized Power',
    category: 'activity',
    units: 'W (Watts)',
    short_description: 'A power average weighted to reflect physiological cost more accurately.',
    full_explanation:
      'Normalized Power (NP) is an algorithm-adjusted average power figure that accounts for the variable nature of cycling — periods of hard effort followed by coasting or easy pedalling. It is designed to reflect the physiological cost of a ride more accurately than simple average power.\n\nThe calculation raises power values to the fourth power before averaging, which weights higher-intensity moments much more heavily. A ride with lots of hard surges followed by coasting will have a higher NP than average power, reflecting the higher physiological demand those surges create.',
    how_measured:
      'NP is calculated from raw power data recorded at 1-second intervals. The algorithm: (1) compute a 30-second rolling average power, (2) raise each value to the 4th power, (3) average these values, (4) take the 4th root of the result.',
    why_track_it:
      'NP is more useful than average power for variable-effort rides. It helps compare the physiological cost of different session types — a flat steady effort vs. a hilly ride with repeated hard climbs — even when average power appears similar.',
    typical_examples:
      'On a flat, steady ride, NP and average power are nearly identical. On a hilly or interval-heavy ride, NP might be 10–20W higher than average power. Dividing NP by FTP produces the Intensity Factor (IF) of a session.',
    limitations:
      'NP is meaningful only for rides with continuous power data — missing data segments corrupt the calculation. It also requires knowledge of your FTP to interpret meaningfully.',
    related_metrics: ['average-power', 'cadence', 'duration'],
  },

  {
    slug: 'cadence',
    title: 'Cadence',
    category: 'activity',
    units: 'rpm (revolutions per minute)',
    short_description: 'Pedal rotation speed in cycling, or stride rate in running.',
    full_explanation:
      'In cycling, cadence is the number of complete pedal revolutions per minute — how fast you are spinning the pedals. In running, cadence refers to stride rate — steps per minute.\n\nIn cycling, cadence affects the relationship between muscular effort and cardiovascular demand. Higher cadences (90–100+ rpm) tend to place more load on the cardiovascular system and less on the muscles. Lower cadences (60–75 rpm) place more load on the muscles. Recreational cyclists often naturally favour lower cadences than trained cyclists.',
    how_measured:
      'Cycling cadence is measured by a sensor attached to the crank or pedal that detects rotation. Running cadence is measured by an accelerometer in a foot pod or wrist device counting steps.',
    why_track_it:
      'Tracking cadence can help optimise efficiency. In cycling, a cadence that matches your strengths and the terrain reduces unnecessary fatigue. In running, low cadence often correlates with overstriding — a common injury risk.',
    typical_examples:
      'Professional cyclists typically maintain 85–100+ rpm during road races. Recreational cyclists often sit at 60–80 rpm. Elite runners typically have a cadence of 170–185 steps/min. A cadence below 160 steps/min in running is often associated with overstriding.',
    limitations:
      'Optimal cadence is individual and context-dependent — there is no single right answer. Increasing cadence significantly in the short term can cause injury if the body has not adapted to the new pattern.',
    related_metrics: ['average-power', 'normalized-power', 'duration'],
  },

  {
    slug: 'elevation-gain',
    title: 'Elevation Gain',
    category: 'activity',
    units: 'm (metres)',
    short_description: 'Total altitude gained throughout an activity.',
    full_explanation:
      'Elevation gain measures the cumulative vertical ascent during an activity — the sum of all uphill sections, regardless of subsequent descents. It is a key measure of the difficulty of a cycling, running, or hiking session, since climbing requires significantly more effort than flat terrain at the same pace or power.\n\nFor cyclists, elevation gain combined with distance gives a much more accurate picture of ride difficulty than distance alone. A flat 80 km ride is far easier than an 80 km ride with 2,000 m of climbing.',
    how_measured:
      'Elevation gain is calculated from GPS altitude data or barometric pressure sensors in the device. Barometric altimeters are more accurate than GPS altitude measurements, which can be noisy.',
    why_track_it:
      'Tracking elevation gain reveals the true load of outdoor training beyond just time and distance. It is useful for understanding why certain sessions feel harder than their distance would suggest, and for planning training load when preparing for hilly events.',
    typical_examples:
      'A flat city ride might have 50–100 m of gain for 40 km. A hilly sportive might have 1,000–1,500 m for the same distance. Mountainous cycling events like Alpine stages in the Tour de France accumulate 3,000–5,000 m in a single day.',
    limitations:
      'GPS altitude data can be unreliable and may smooth out short climbs. Different devices sometimes report significantly different elevation totals for the same route. Descents are excluded from the total — only uphill sections are counted.',
    related_metrics: ['distance', 'duration', 'average-power'],
  },

  {
    slug: 'pace',
    title: 'Pace',
    category: 'activity',
    units: 'min/km (minutes per kilometre)',
    short_description: 'Time taken to cover one kilometre, used in running.',
    full_explanation:
      'Pace is the inverse of speed — instead of distance per unit of time, it expresses time per unit of distance. In running, pace in minutes per kilometre is the standard measure of effort. A faster pace (lower number) indicates harder running; a slower pace (higher number) indicates easier running.\n\nPace varies significantly based on terrain, fatigue, temperature, and the purpose of the session — easy recovery runs are deliberately slow; race-effort runs are much faster.',
    how_measured:
      'Pace is calculated by dividing elapsed time by distance covered, typically drawn from GPS data in a watch or phone.',
    why_track_it:
      'Monitoring pace over training cycles reveals fitness improvements — running the same pace at lower heart rate, or running a faster pace at the same heart rate, both signal improving fitness. Pace also helps structure training: different types of sessions (easy, tempo, intervals) target different pace ranges.',
    typical_examples:
      'A casual jogger might run at 7:00–8:00 min/km. A recreational runner might aim for 5:00–6:00 min/km for a moderate effort. Sub-4:30 min/km is typical for a trained runner doing tempo work. Elite marathon pace for world-class runners approaches 2:50 min/km.',
    limitations:
      'Pace is terrain-dependent — pace on flat roads is not comparable to pace on hills or trails. Heart rate provides a better intensity comparison across different terrains than pace does.',
    related_metrics: ['speed', 'distance', 'heart-rate'],
  },

  {
    slug: 'speed',
    title: 'Speed',
    category: 'activity',
    units: 'km/h (kilometres per hour)',
    short_description: 'Distance covered per unit of time.',
    full_explanation:
      'Speed measures how quickly you are covering distance — kilometres per hour. It is the reciprocal of pace (pace = 60 / speed). Speed is the more common metric for cycling and other wheeled activities, while running typically uses pace.\n\nIn cycling, speed is highly dependent on terrain, wind, and equipment — a cyclist can go 35 km/h easily downhill but only 15 km/h on a steep climb. This makes speed a poor measure of effort in cycling compared to power.',
    how_measured:
      'Speed is measured by GPS in most devices — comparing position over time to calculate velocity. Cycling computers may also use a wheel speed sensor for more consistent readings independent of GPS signal.',
    why_track_it:
      'Average speed is commonly used to report cycling performance. It provides a quick summary of how quickly a route was completed, useful for tracking performance on familiar routes.',
    typical_examples:
      'Recreational cyclists average 20–25 km/h on flat terrain. Trained road cyclists often ride at 28–35 km/h in groups. Professional races average 40–50 km/h including climbs and descents.',
    limitations:
      'Speed in cycling is heavily influenced by wind and gradient — it is a poor indicator of absolute effort or fitness. Power is a much better measure of cycling intensity. Speed for running is typically expressed as pace (min/km) instead.',
    related_metrics: ['pace', 'distance', 'average-power'],
  },
]

export function getMetric(slug: string): MetricDefinition | undefined {
  return METRICS.find(m => m.slug === slug)
}

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  recovery: 'Recovery & Heart',
  sleep:    'Sleep',
  nutrition:'Nutrition',
  body:     'Body',
  activity: 'Activity & Performance',
}

export const CATEGORY_ORDER: MetricCategory[] = [
  'recovery',
  'sleep',
  'nutrition',
  'body',
  'activity',
]
