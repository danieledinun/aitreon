#!/usr/bin/env python3
"""
Demo analysis results for The Air Fryer Geek using actual transcript data.
"""

import re
import json
from collections import Counter, defaultdict
from typing import List, Dict, Tuple

# Actual Air Fryer Geek transcript data
TRANSCRIPT_DATA = [
    {"content": "ciao culinary geeks today i'm super excited to \nbring it to you five super easy air fryer recipes", "start_time": 0, "end_time": 6, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "with five or less ingredients a little disclaimer \nhere salt and pepper are not considered in the", "start_time": 6, "end_time": 11.36, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "count of the five ingredients come on those \nare the basics let's check it out all right", "start_time": 11.36, "end_time": 16, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "we start off with buffalo chicken wings this is \nsuper easy to make first step we're gonna pat dry", "start_time": 16, "end_time": 21.76, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "our chicken i'm gonna start right right super easy \nwith a little bit of salt and pepper both side", "start_time": 21.76, "end_time": 26.72, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "we're gonna let this salt and pepper sit for \na while in the meantime we're gonna prepare", "start_time": 26.72, "end_time": 31.84, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "the buffalo sauce all right i have here two \ntablespoons of butter that is melted here in my", "start_time": 31.84, "end_time": 36.24, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "little pan here and then i'm gonna put just a \ncouple of garlic cloves i'm gonna smash it out", "start_time": 37.04, "end_time": 41.76, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "like this all right i got my garlic cooking for \nabout a couple of minutes and i'm gonna add one", "start_time": 41.76, "end_time": 46.4, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "third of a cup of the frank's red hot sauce that i \nlove it just in all right i'm gonna cook my sauce", "start_time": 46.4, "end_time": 53.04, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "for about 10-15 minutes all right i've been pre \nheating my air fryer for 10 minutes at 370 degrees", "start_time": 53.04, "end_time": 57.44, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "farenheight i have here my buffalo chicken wings \nsome olive oil i'm gonna place first skin side up", "start_time": 57.44, "end_time": 64.96, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "and cook for 10 minutes halfway through i'm gonna \nflip it over i found that putting skin side up", "start_time": 66.4, "end_time": 73.44, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "helps me in maintaining the moisture inside my \nchicken wings so they're gonna get better by", "start_time": 73.44, "end_time": 78.64, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "more softer inside because the skin will render \nthe fat inside first and then we can flip it over", "start_time": 78.64, "end_time": 84.48, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "if you want to learn how to use better your cosori \nair fryer or learn how to air fry in general", "start_time": 84.48, "end_time": 89.12, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "i have a video about the top 11 air fryer mistakes \nthat you should avoid i'm gonna drop for your link", "start_time": 89.12, "end_time": 94.56, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "down below and up here to check that out all right \nten minutes have gone by and now just take our", "start_time": 94.56, "end_time": 100.8, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "chicken wings i just flip it over halfway through \nas i say that apply a little bit of olive oil", "start_time": 101.84, "end_time": 106.32, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "this uh they look like right now so i'm gonna flip \nagain raise the temperature at 400 degrees F for", "start_time": 107.04, "end_time": 114.88, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "other five minutes then i'm gonna \ncook for an additional three minutes", "start_time": 114.88, "end_time": 118.96, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "just put the sauce on top let's check it out \nall right last minute of cooking at 400 degrees", "start_time": 119.52, "end_time": 124.32, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "fahrenheit look at this sauce it's nice it's \ntick it's spicy it's garlicky and everything", "start_time": 124.32, "end_time": 130.64, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "you need in a perfectly buffalo hot sauce they \nare pretty much cooked this time they're nice and", "start_time": 130.64, "end_time": 136.8, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "crispy what i'm gonna do is very very simple \ni'm gonna apply a little bit of sauce on top", "start_time": 136.8, "end_time": 142, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "and then we want this to caramelize for \nabout one minute at 400 degrees fahrenheit", "start_time": 142.88, "end_time": 146.24, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "now what i'm gonna do is take this look at this \nthey look awesome smells absolutely amazing", "start_time": 148.4, "end_time": 155.68, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "so what you can do is like place one by one your \nwings inside the sauce just toss it a little bit", "start_time": 155.68, "end_time": 161.6, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "that's it i'm gonna jump straight in the second \nrecipe salmon in foil with pesto broccoli and a", "start_time": 162.72, "end_time": 169.76, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "little tomato this is super easy to make so i have \nhere two foil here two pieces of aluminum foil", "start_time": 169.76, "end_time": 176.08, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "that where i'm gonna place my ingredients in put \nin the fryer and cook super easy first i'm gonna", "start_time": 176.08, "end_time": 182.56, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "place a little bit of extra virgin olive oil on \nthe base i'm going to create a bed of my nice", "start_time": 182.56, "end_time": 188.16, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "broccoli right here and spray a \nlittle bit of olive oil on top", "start_time": 188.16, "end_time": 192.16, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "add a tiny bit of salt and pepper now the list of \ningredients down below that you can check it out", "start_time": 195.6, "end_time": 202.64, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "i'm going to place my salmon right on top \nof this bed of broccoli spray a little bit", "start_time": 203.2, "end_time": 208.56, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "of longer here so i have here store-bought pesto \njust put like a tablespoon on top then i'm gonna", "start_time": 208.56, "end_time": 215.28, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "place a little bit of tomato that just cut and \ni'm gonna just spread a little bit of crumbled", "start_time": 215.28, "end_time": 221.92, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "feta on top just like that i'm gonna close my foil \njust like this one two and the second one as well", "start_time": 221.92, "end_time": 229.52, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "so as always we want to make sure \nthat our air fryer is nice and hot", "start_time": 230.32, "end_time": 233.2, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "so i've been cooking before so my cosori is very \nhot off and i'm gonna place this nice some right", "start_time": 233.76, "end_time": 241.52, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "in i'm gonna cook it 400 degrees fahrenheit for \nabout 12 minutes open up check if the salmon is", "start_time": 241.52, "end_time": 247.52, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "the right temperature otherwise you can add about \nthree to five minutes more all right my third", "start_time": 247.52, "end_time": 251.76, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "recipe is so easy it's so good chicken breast \ntwo slices of swiss cheese two slices of ham", "start_time": 251.76, "end_time": 258.24, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "one egg with a little bit of water in it and \npancake bread crumbs and as always salt and pepper", "start_time": 258.88, "end_time": 264.24, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "this is super super easy to make and so delicious \nis ridiculous chicken cordon blue basically super", "start_time": 264.24, "end_time": 269.84, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "easy now as always we have our chicken breast \nwe can pound it or not and remember first to", "start_time": 269.84, "end_time": 276.8, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "turn it on your air fryer and preheat while \nwe're preparing this it's so easy and so quick", "start_time": 276.8, "end_time": 281.28, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "that we want to start right now to preheat \ni'm gonna pre heat at 370 degree what i do", "start_time": 281.28, "end_time": 286.4, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "is pretty easy instead of opening everything \ni just created pocket all right so as you can", "start_time": 286.4, "end_time": 290.72, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"},
    {"content": "see i have created a pocket so i have not opened \neverything up if you want optional you can pound", "start_time": 290.72, "end_time": 296.16, "video_title": "Easy Air Fryer Recipes For Beginners | ONLY 5 Ingredients!!!", "video_id": "cmezuug2n005x2axkpd2bcr0k"}
]

class AirFryerGeekAnalyzer:
    """Analyze The Air Fryer Geek's speech patterns."""

    def __init__(self):
        self.signature_phrases = [
            "i'm gonna", "gonna", "super easy", "all right", "alright",
            "a little bit", "little bit", "just like", "right here",
            "very very", "so easy", "check it out", "as always"
        ]

        self.filler_words = [
            "um", "uh", "ah", "like", "you know", "so", "well",
            "actually", "basically", "literally", "right", "okay"
        ]

    def clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        text = re.sub(r'\n', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text.lower()

    def analyze_speech_patterns(self) -> Dict:
        """Analyze speech patterns from transcript data."""

        # Combine all content
        all_text = []
        total_duration = 0
        word_count = 0

        for chunk in TRANSCRIPT_DATA:
            cleaned = self.clean_text(chunk['content'])
            all_text.append(cleaned)
            word_count += len(cleaned.split())
            total_duration += (chunk['end_time'] - chunk['start_time'])

        combined_text = ' '.join(all_text)
        words = combined_text.split()

        # Calculate signature phrase usage
        phrase_counts = {}
        for phrase in self.signature_phrases:
            count = combined_text.count(phrase)
            if count > 0:
                phrase_counts[phrase] = count

        # Calculate filler word usage
        filler_counts = {}
        for filler in self.filler_words:
            count = len([w for w in words if w == filler])
            if count > 0:
                filler_counts[filler] = count

        # Analyze sentence patterns
        sentences = re.split(r'[.!?]+', combined_text)
        sentence_lengths = [len(s.split()) for s in sentences if s.strip()]

        # POV analysis
        first_person = ['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our']
        second_person = ['you', 'your', 'yours', 'yourself']

        first_count = sum(1 for w in words if w in first_person)
        second_count = sum(1 for w in words if w in second_person)

        # Calculate speaking rate (words per minute)
        speaking_rate = (word_count / total_duration) * 60 if total_duration > 0 else 0

        return {
            'total_segments': len(TRANSCRIPT_DATA),
            'total_words': word_count,
            'total_duration_seconds': total_duration,
            'speaking_rate_wpm': speaking_rate,
            'signature_phrases': phrase_counts,
            'filler_words': filler_counts,
            'avg_sentence_length': sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0,
            'pov_analysis': {
                'first_person_ratio': first_count / word_count if word_count > 0 else 0,
                'second_person_ratio': second_count / word_count if word_count > 0 else 0,
                'direct_address': second_count > first_count
            },
            'communication_style': self.analyze_communication_style(combined_text, words),
            'sample_text': combined_text[:300] + '...'
        }

    def analyze_communication_style(self, text: str, words: List[str]) -> Dict:
        """Analyze communication style patterns."""

        # Enthusiasm markers
        enthusiasm_markers = ['super', 'awesome', 'amazing', 'absolutely', 'ridiculous', 'delicious']
        enthusiasm_count = sum(1 for w in words if w in enthusiasm_markers)

        # Instructional language
        instructional_words = ['first', 'then', 'next', 'now', 'after', 'before', 'step']
        instructional_count = sum(1 for w in words if w in instructional_words)

        # Equipment mentions
        equipment_mentions = text.count('air fryer') + text.count('cosori')

        # Cooking terms
        cooking_terms = ['cook', 'cooking', 'heat', 'temperature', 'degrees', 'minutes', 'flip', 'place']
        cooking_count = sum(1 for w in words if w in cooking_terms)

        return {
            'enthusiasm_ratio': enthusiasm_count / len(words) if words else 0,
            'instructional_ratio': instructional_count / len(words) if words else 0,
            'equipment_focus': equipment_mentions,
            'cooking_terminology_ratio': cooking_count / len(words) if words else 0,
            'tone': 'enthusiastic_instructor'
        }

    def generate_style_card(self, analysis: Dict) -> str:
        """Generate a style card for AI prompting."""

        top_phrases = sorted(analysis['signature_phrases'].items(), key=lambda x: x[1], reverse=True)[:5]

        style_card = f"""**The Air Fryer Geek's Communication Style Profile**

**Core Speaking Patterns:**
• Speaking rate: {analysis['speaking_rate_wpm']:.1f} words per minute (conversational pace)
• Average sentence length: {analysis['avg_sentence_length']:.1f} words
• Total analyzed: {analysis['total_segments']} segments, {analysis['total_words']} words

**Signature Phrases & Expressions:**"""

        for phrase, count in top_phrases:
            style_card += f"\n• \"{phrase}\" - used {count} times"

        style_card += f"""

**Communication Style:**
• Enthusiasm level: {analysis['communication_style']['enthusiasm_ratio']:.1%} enthusiastic words
• Instructional approach: {analysis['communication_style']['instructional_ratio']:.1%} instructional language
• Direct audience engagement: {"High" if analysis['pov_analysis']['direct_address'] else "Moderate"}
• Personal sharing: {analysis['pov_analysis']['first_person_ratio']:.1%} first-person pronouns

**Tone & Personality:**
• Energetic and enthusiastic about cooking
• Clear, step-by-step instructional style
• Friendly, approachable "geek" persona
• Equipment-focused (mentions air fryer frequently)
• Uses Italian greeting "ciao culinary geeks"

**AI Prompting Guidelines:**
When mimicking The Air Fryer Geek's style:
1. Use signature phrases like "super easy", "i'm gonna", "all right"
2. Maintain enthusiastic, instructional tone
3. Include step-by-step cooking guidance
4. Reference air fryer techniques and temperatures
5. Address audience directly as "culinary geeks"
6. Use simple, conversational language with occasional repetition
7. Express genuine excitement about food and cooking results

**Sample Voice:**
"{analysis['sample_text']}"
"""

        return style_card

def main():
    """Run the analysis and display results."""
    print("🚀 The Air Fryer Geek Speech Pattern Analysis")
    print("=" * 60)

    analyzer = AirFryerGeekAnalyzer()
    analysis = analyzer.analyze_speech_patterns()
    style_card = analyzer.generate_style_card(analysis)

    print("\n📊 ANALYSIS RESULTS:")
    print("-" * 40)

    print(f"Total segments analyzed: {analysis['total_segments']}")
    print(f"Total words: {analysis['total_words']}")
    print(f"Speaking rate: {analysis['speaking_rate_wpm']:.1f} words/minute")
    print(f"Average sentence length: {analysis['avg_sentence_length']:.1f} words")

    print(f"\n🎯 TOP SIGNATURE PHRASES:")
    for phrase, count in sorted(analysis['signature_phrases'].items(), key=lambda x: x[1], reverse=True)[:7]:
        print(f"  • '{phrase}': {count} times")

    print(f"\n💬 COMMUNICATION PATTERNS:")
    print(f"  • Enthusiasm ratio: {analysis['communication_style']['enthusiasm_ratio']:.1%}")
    print(f"  • Instructional language: {analysis['communication_style']['instructional_ratio']:.1%}")
    print(f"  • Direct address ratio: {analysis['pov_analysis']['second_person_ratio']:.1%}")
    print(f"  • Personal sharing: {analysis['pov_analysis']['first_person_ratio']:.1%}")

    print(f"\n" + "=" * 60)
    print("STYLE CARD FOR AI PROMPTING")
    print("=" * 60)
    print(style_card)

    # Save results
    with open('airfryer_geek_analysis.json', 'w') as f:
        json.dump({
            'analysis': analysis,
            'style_card': style_card
        }, f, indent=2)

    print(f"\n💾 Analysis saved to airfryer_geek_analysis.json")
    print("✅ Analysis complete!")

if __name__ == "__main__":
    main()