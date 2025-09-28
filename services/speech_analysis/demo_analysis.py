#!/usr/bin/env python3
"""
Demo analysis of The Air Fryer Geek using the actual transcript data.
This demonstrates the speech pattern analysis system with real data.
"""

import re
import json
from collections import Counter, defaultdict
from typing import List, Dict, Tuple
import numpy as np

# Sample of The Air Fryer Geek transcript data
AIR_FRYER_GEEK_DATA = [
    {"content": "ciao culinary geeks today i'm super excited to bring it to you five super easy air fryer recipes", "start_time": 0, "end_time": 6},
    {"content": "with five or less ingredients a little disclaimer here salt and pepper are not considered in the", "start_time": 6, "end_time": 11.36},
    {"content": "count of the five ingredients come on those are the basics let's check it out all right", "start_time": 11.36, "end_time": 16},
    {"content": "we start off with buffalo chicken wings this is super easy to make first step we're gonna pat dry", "start_time": 16, "end_time": 21.76},
    {"content": "our chicken i'm gonna start right right super easy with a little bit of salt and pepper both side", "start_time": 21.76, "end_time": 26.72},
    {"content": "we're gonna let this salt and pepper sit for a while in the meantime we're gonna prepare", "start_time": 26.72, "end_time": 31.84},
    {"content": "the buffalo sauce all right i have here two tablespoons of butter that is melted here in my", "start_time": 31.84, "end_time": 36.24},
    {"content": "little pan here and then i'm gonna put just a couple of garlic cloves i'm gonna smash it out", "start_time": 37.04, "end_time": 41.76},
    {"content": "like this all right i got my garlic cooking for about a couple of minutes and i'm gonna add one", "start_time": 41.76, "end_time": 46.4},
    {"content": "third of a cup of the frank's red hot sauce that i love it just in all right i'm gonna cook my sauce", "start_time": 46.4, "end_time": 53.04},
    {"content": "for about 10-15 minutes all right i've been pre heating my air fryer for 10 minutes at 370 degrees", "start_time": 53.04, "end_time": 57.44},
    {"content": "farenheight i have here my buffalo chicken wings some olive oil i'm gonna place first skin side up", "start_time": 57.44, "end_time": 64.96},
    {"content": "and cook for 10 minutes halfway through i'm gonna flip it over i found that putting skin side up", "start_time": 66.4, "end_time": 73.44},
    {"content": "helps me in maintaining the moisture inside my chicken wings so they're gonna get better by", "start_time": 73.44, "end_time": 78.64},
    {"content": "more softer inside because the skin will render the fat inside first and then we can flip it over", "start_time": 78.64, "end_time": 84.48},
    {"content": "if you want to learn how to use better your cosori air fryer or learn how to air fry in general", "start_time": 84.48, "end_time": 89.12},
    {"content": "i have a video about the top 11 air fryer mistakes that you should avoid i'm gonna drop for your link", "start_time": 89.12, "end_time": 94.56},
    {"content": "down below and up here to check that out all right ten minutes have gone by and now just take our", "start_time": 94.56, "end_time": 100.8},
    {"content": "chicken wings i just flip it over halfway through as i say that apply a little bit of olive oil", "start_time": 101.84, "end_time": 106.32},
    {"content": "this uh they look like right now so i'm gonna flip again raise the temperature at 400 degrees F for", "start_time": 107.04, "end_time": 114.88},
    {"content": "other five minutes then i'm gonna cook for an additional three minutes", "start_time": 114.88, "end_time": 118.96},
    {"content": "just put the sauce on top let's check it out all right last minute of cooking at 400 degrees", "start_time": 119.52, "end_time": 124.32},
    {"content": "fahrenheit look at this sauce it's nice it's tick it's spicy it's garlicky and everything", "start_time": 124.32, "end_time": 130.64},
    {"content": "you need in a perfectly buffalo hot sauce they are pretty much cooked this time they're nice and", "start_time": 130.64, "end_time": 136.8},
    {"content": "crispy what i'm gonna do is very very simple i'm gonna apply a little bit of sauce on top", "start_time": 136.8, "end_time": 142},
    {"content": "and then we want this to caramelize for about one minute at 400 degrees fahrenheit", "start_time": 142.88, "end_time": 146.24},
    {"content": "now what i'm gonna do is take this look at this they look awesome smells absolutely amazing", "start_time": 148.4, "end_time": 155.68},
    {"content": "so what you can do is like place one by one your wings inside the sauce just toss it a little bit", "start_time": 155.68, "end_time": 161.6},
    {"content": "that's it i'm gonna jump straight in the second recipe salmon in foil with pesto broccoli and a", "start_time": 162.72, "end_time": 169.76},
    {"content": "little tomato this is super easy to make so i have here two foil here two pieces of aluminum foil", "start_time": 169.76, "end_time": 176.08},
    {"content": "that where i'm gonna place my ingredients in put in the fryer and cook super easy first i'm gonna", "start_time": 176.08, "end_time": 182.56},
    {"content": "place a little bit of extra virgin olive oil on the base i'm going to create a bed of my nice", "start_time": 182.56, "end_time": 188.16},
    {"content": "broccoli right here and spray a little bit of olive oil on top", "start_time": 188.16, "end_time": 192.16},
    {"content": "add a tiny bit of salt and pepper now the list of ingredients down below that you can check it out", "start_time": 195.6, "end_time": 202.64},
    {"content": "i'm going to place my salmon right on top of this bed of broccoli spray a little bit", "start_time": 203.2, "end_time": 208.56},
    {"content": "of longer here so i have here store-bought pesto just put like a tablespoon on top then i'm gonna", "start_time": 208.56, "end_time": 215.28},
    {"content": "place a little bit of tomato that just cut and i'm gonna just spread a little bit of crumbled", "start_time": 215.28, "end_time": 221.92},
    {"content": "feta on top just like that i'm gonna close my foil just like this one two and the second one as well", "start_time": 221.92, "end_time": 229.52},
    {"content": "so as always we want to make sure that our air fryer is nice and hot", "start_time": 230.32, "end_time": 233.2},
    {"content": "so i've been cooking before so my cosori is very hot off and i'm gonna place this nice some right", "start_time": 233.76, "end_time": 241.52},
    {"content": "in i'm gonna cook it 400 degrees fahrenheit for about 12 minutes open up check if the salmon is", "start_time": 241.52, "end_time": 247.52},
    {"content": "the right temperature otherwise you can add about three to five minutes more all right my third", "start_time": 247.52, "end_time": 251.76},
    {"content": "recipe is so easy it's so good chicken breast two slices of swiss cheese two slices of ham", "start_time": 251.76, "end_time": 258.24},
    {"content": "one egg with a little bit of water in it and pancake bread crumbs and as always salt and pepper", "start_time": 258.88, "end_time": 264.24},
    {"content": "this is super super easy to make and so delicious is ridiculous chicken cordon blue basically super", "start_time": 264.24, "end_time": 269.84},
    {"content": "easy now as always we have our chicken breast we can pound it or not and remember first to", "start_time": 269.84, "end_time": 276.8},
    {"content": "turn it on your air fryer and preheat while we're preparing this it's so easy and so quick", "start_time": 276.8, "end_time": 281.28},
    {"content": "that we want to start right now to preheat i'm gonna pre heat at 370 degree what i do", "start_time": 281.28, "end_time": 286.4},
    {"content": "is pretty easy instead of opening everything i just created pocket all right so as you can", "start_time": 286.4, "end_time": 290.72},
    {"content": "see i have created a pocket so i have not opened everything up if you want optional you can pound", "start_time": 290.72, "end_time": 296.16}
]

class AirFryerGeekAnalyzer:
    """Analyzes The Air Fryer Geek's speech patterns using real transcript data."""

    def __init__(self):
        self.filler_words = {
            'um', 'uh', 'ah', 'er', 'like', 'you know', 'so', 'well',
            'actually', 'basically', 'literally', 'right', 'okay', 'alright',
            'i mean', 'kind of', 'sort of', 'all right'
        }

    def analyze_speech_patterns(self) -> Dict:
        """Analyze The Air Fryer Geek's speech patterns."""
        # Combine all content
        all_text = ' '.join([chunk['content'] for chunk in AIR_FRYER_GEEK_DATA])
        all_words = all_text.split()

        analysis = {
            'total_segments': len(AIR_FRYER_GEEK_DATA),
            'total_words': len(all_words),
            'total_duration': AIR_FRYER_GEEK_DATA[-1]['end_time'] - AIR_FRYER_GEEK_DATA[0]['start_time'],
            'speaking_rate_wpm': 0,
            'signature_phrases': [],
            'filler_analysis': {},
            'sentence_patterns': {},
            'vocabulary_analysis': {},
            'communication_style': {},
            'enthusiasm_markers': []
        }

        # Calculate speaking rate
        total_duration_minutes = analysis['total_duration'] / 60
        analysis['speaking_rate_wpm'] = analysis['total_words'] / total_duration_minutes

        # Analyze filler words and signature phrases
        analysis['filler_analysis'] = self._analyze_fillers(all_text, all_words)
        analysis['signature_phrases'] = self._find_signature_phrases(all_text)
        analysis['sentence_patterns'] = self._analyze_sentence_patterns()
        analysis['vocabulary_analysis'] = self._analyze_vocabulary(all_words)
        analysis['communication_style'] = self._analyze_communication_style(all_text, all_words)
        analysis['enthusiasm_markers'] = self._find_enthusiasm_markers(all_text)

        return analysis

    def _analyze_fillers(self, text: str, words: List[str]) -> Dict:
        """Analyze filler word usage."""
        text_lower = text.lower()
        filler_counts = {}
        total_words = len(words)

        for filler in self.filler_words:
            if ' ' in filler:
                count = text_lower.count(filler)
            else:
                count = len([w for w in words if w.lower() == filler])

            if count > 0:
                filler_counts[filler] = {
                    'count': count,
                    'frequency': count / total_words,
                    'percentage': (count / total_words) * 100
                }

        return dict(sorted(filler_counts.items(), key=lambda x: x[1]['count'], reverse=True))

    def _find_signature_phrases(self, text: str) -> List[Tuple[str, int]]:
        """Find recurring signature phrases."""
        # Look for repeated phrases
        phrases = []

        # Common cooking phrases
        cooking_phrases = [
            "i'm gonna", "super easy", "all right", "look at this",
            "check it out", "a little bit", "just like that",
            "what i do", "air fryer", "degrees fahrenheit"
        ]

        text_lower = text.lower()
        for phrase in cooking_phrases:
            count = text_lower.count(phrase)
            if count >= 2:
                phrases.append((phrase, count))

        return sorted(phrases, key=lambda x: x[1], reverse=True)

    def _analyze_sentence_patterns(self) -> Dict:
        """Analyze sentence structure patterns."""
        sentences = []
        for chunk in AIR_FRYER_GEEK_DATA:
            # Split by common sentence endings
            chunk_sentences = re.split(r'[.!?]+|all right|okay', chunk['content'])
            sentences.extend([s.strip() for s in chunk_sentences if s.strip()])

        sentence_lengths = [len(s.split()) for s in sentences]

        return {
            'total_sentences': len(sentences),
            'avg_sentence_length': np.mean(sentence_lengths) if sentence_lengths else 0,
            'sentence_length_std': np.std(sentence_lengths) if sentence_lengths else 0,
            'short_sentences': len([l for l in sentence_lengths if l <= 8]),
            'medium_sentences': len([l for l in sentence_lengths if 9 <= l <= 15]),
            'long_sentences': len([l for l in sentence_lengths if l > 15])
        }

    def _analyze_vocabulary(self, words: List[str]) -> Dict:
        """Analyze vocabulary patterns."""
        word_freq = Counter([w.lower() for w in words])

        # Cooking-specific terms
        cooking_terms = ['air', 'fryer', 'cook', 'chicken', 'sauce', 'oil', 'temperature',
                        'minutes', 'degrees', 'recipe', 'ingredients', 'easy']

        cooking_term_count = sum(word_freq.get(term, 0) for term in cooking_terms)

        return {
            'unique_words': len(word_freq),
            'most_common_words': word_freq.most_common(10),
            'cooking_terms_frequency': cooking_term_count / len(words),
            'type_token_ratio': len(word_freq) / len(words)
        }

    def _analyze_communication_style(self, text: str, words: List[str]) -> Dict:
        """Analyze communication and engagement style."""
        text_lower = text.lower()

        # Personal pronouns
        i_count = len([w for w in words if w.lower() == 'i'])
        you_count = len([w for w in words if w.lower() in ['you', 'your']])
        we_count = len([w for w in words if w.lower() in ['we', "we're"]])

        # Engagement phrases
        engagement_phrases = ['check it out', 'look at this', 'you can', 'you want', 'down below']
        engagement_count = sum(text_lower.count(phrase) for phrase in engagement_phrases)

        # Instructional language
        instruction_phrases = ["i'm gonna", "we're gonna", "first step", "what i do", "now"]
        instruction_count = sum(text_lower.count(phrase) for phrase in instruction_phrases)

        total_words = len(words)
        return {
            'personal_sharing': i_count / total_words,  # "I" usage
            'audience_engagement': you_count / total_words,  # "you" usage
            'inclusive_language': we_count / total_words,  # "we" usage
            'engagement_phrases': engagement_count,
            'instructional_tone': instruction_count,
            'direct_communication': engagement_count + instruction_count
        }

    def _find_enthusiasm_markers(self, text: str) -> List[str]:
        """Find markers of enthusiasm and energy."""
        markers = []
        text_lower = text.lower()

        # Enthusiasm words
        enthusiasm_words = ['super', 'awesome', 'amazing', 'perfect', 'love', 'excited']
        for word in enthusiasm_words:
            count = text_lower.count(word)
            if count > 0:
                markers.append(f"Uses '{word}' {count} times")

        # Repetition for emphasis
        if 'super super' in text_lower:
            markers.append("Uses repetition for emphasis ('super super')")

        if 'very very' in text_lower:
            markers.append("Uses repetition for emphasis ('very very')")

        return markers

    def generate_style_card(self, analysis: Dict) -> str:
        """Generate a comprehensive style card for The Air Fryer Geek."""

        card_parts = [
            "**The Air Fryer Geek's Communication Style:**",
            "",
            f"A cooking educator who combines instructional content with personal enthusiasm. "
            f"Speaks at {analysis['speaking_rate_wpm']:.0f} words per minute with a conversational, "
            f"step-by-step teaching approach.",
            "",
            "**Key Speech Patterns:**"
        ]

        # Top filler words
        if analysis['filler_analysis']:
            top_fillers = list(analysis['filler_analysis'].items())[:3]
            for filler, data in top_fillers:
                card_parts.append(f"- Uses '{filler}' frequently ({data['percentage']:.1f}% of speech)")

        # Signature phrases
        card_parts.append("\n**Signature Phrases:**")
        for phrase, count in analysis['signature_phrases'][:5]:
            card_parts.append(f"- '{phrase}' (used {count} times)")

        # Communication style
        style = analysis['communication_style']
        card_parts.extend([
            "\n**Communication Style:**",
            f"- High instructional tone with {style['instructional_tone']} teaching phrases",
            f"- Direct audience engagement with {style['engagement_phrases']} engagement markers",
            f"- Personal sharing style ({style['personal_sharing']:.1%} first-person usage)",
            f"- Inclusive teaching approach ({style['inclusive_language']:.1%} 'we' usage)"
        ])

        # Sentence structure
        sentences = analysis['sentence_patterns']
        if sentences['avg_sentence_length'] > 0:
            card_parts.extend([
                "\n**Speaking Style:**",
                f"- Average sentence length: {sentences['avg_sentence_length']:.1f} words",
                f"- Prefers conversational explanations with step-by-step breakdowns",
                f"- Speaking rate: {analysis['speaking_rate_wpm']:.0f} WPM (measured pace)"
            ])

        # Enthusiasm markers
        if analysis['enthusiasm_markers']:
            card_parts.append("\n**Enthusiasm Markers:**")
            for marker in analysis['enthusiasm_markers'][:4]:
                card_parts.append(f"- {marker}")

        # Vocabulary focus
        vocab = analysis['vocabulary_analysis']
        card_parts.extend([
            "\n**Content Focus:**",
            f"- Cooking-specific vocabulary: {vocab['cooking_terms_frequency']:.1%} of speech",
            f"- Vocabulary diversity: {vocab['type_token_ratio']:.3f} (type-token ratio)",
            f"- Most repeated words: {', '.join([word for word, count in vocab['most_common_words'][:5]])}"
        ])

        return "\n".join(card_parts)

def main():
    """Run The Air Fryer Geek analysis demo."""
    print("🍳 The Air Fryer Geek - Speech Pattern Analysis Demo")
    print("=" * 60)

    analyzer = AirFryerGeekAnalyzer()
    analysis = analyzer.analyze_speech_patterns()

    print(f"\n📊 Analysis Summary:")
    print(f"   • Analyzed {analysis['total_segments']} content segments")
    print(f"   • Total words: {analysis['total_words']:,}")
    print(f"   • Speaking rate: {analysis['speaking_rate_wpm']:.0f} WPM")
    print(f"   • Content duration: {analysis['total_duration']:.1f} seconds")

    # Show key findings
    print(f"\n🗣️  Top Speech Patterns:")
    for filler, data in list(analysis['filler_analysis'].items())[:5]:
        print(f"   • '{filler}': {data['count']} times ({data['percentage']:.1f}%)")

    print(f"\n💬 Signature Phrases:")
    for phrase, count in analysis['signature_phrases'][:5]:
        print(f"   • '{phrase}': {count} times")

    print(f"\n👤 Communication Style:")
    style = analysis['communication_style']
    print(f"   • Personal sharing: {style['personal_sharing']:.1%}")
    print(f"   • Audience engagement: {style['audience_engagement']:.1%}")
    print(f"   • Inclusive language: {style['inclusive_language']:.1%}")
    print(f"   • Instructional phrases: {style['instructional_tone']} instances")

    # Generate style card
    style_card = analyzer.generate_style_card(analysis)

    print("\n" + "=" * 60)
    print("STYLE CARD FOR AI PROMPTING")
    print("=" * 60)
    print(style_card)
    print("=" * 60)

    # Save results
    with open('airfryer_geek_demo_results.json', 'w') as f:
        json.dump({
            'analysis': analysis,
            'style_card': style_card
        }, f, indent=2, default=str)

    print(f"\n💾 Results saved to airfryer_geek_demo_results.json")
    print("✅ Demo analysis complete!")

    # Show how this would improve AI responses
    print("\n" + "=" * 60)
    print("AI RESPONSE IMPROVEMENT DEMO")
    print("=" * 60)

    print("❌ BEFORE (Generic AI):")
    print("\"To cook chicken wings in an air fryer, set temperature to 375°F and cook for 20 minutes.\"")

    print("\n✅ AFTER (Using Air Fryer Geek Style):")
    print("\"All right, culinary geeks! So we're gonna make these super easy air fryer chicken wings - ")
    print("this is gonna be absolutely amazing! First step, we're gonna pat dry our chicken wings, ")
    print("season with a little bit of salt and pepper on both sides. I'm gonna preheat my air fryer ")
    print("to 375 degrees Fahrenheit for about 5 minutes. Then we're gonna cook these bad boys for ")
    print("about 20 minutes, flipping halfway through. Look at this - they're gonna come out nice ")
    print("and crispy! Check it out, you can see how golden and delicious they look. That's it - ")
    print("super super easy and so good!\"")

if __name__ == "__main__":
    main()