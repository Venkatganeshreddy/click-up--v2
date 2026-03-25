import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';

// Common misspellings dictionary
const commonMisspellings: Record<string, string> = {
  'discribe': 'describe',
  'descripbe': 'describe',
  'descrieb': 'describe',
  'descripion': 'description',
  'descripton': 'description',
  'descrption': 'description',
  'desription': 'description',
  'teh': 'the',
  'hte': 'the',
  'adn': 'and',
  'nad': 'and',
  'taht': 'that',
  'thta': 'that',
  'wiht': 'with',
  'whit': 'with',
  'form': 'from',
  'fomr': 'form',
  'yoru': 'your',
  'yuor': 'your',
  'youre': "you're",
  'dont': "don't",
  'wont': "won't",
  'cant': "can't",
  'isnt': "isn't",
  'wasnt': "wasn't",
  'doesnt': "doesn't",
  'didnt': "didn't",
  'havent': "haven't",
  'hasnt': "hasn't",
  'wouldnt': "wouldn't",
  'couldnt': "couldn't",
  'shouldnt': "shouldn't",
  'recieve': 'receive',
  'reciept': 'receipt',
  'occured': 'occurred',
  'occurence': 'occurrence',
  'occurance': 'occurrence',
  'seperate': 'separate',
  'seperately': 'separately',
  'definately': 'definitely',
  'definatly': 'definitely',
  'defintely': 'definitely',
  'accomodate': 'accommodate',
  'acommodate': 'accommodate',
  'acheive': 'achieve',
  'achievment': 'achievement',
  'adress': 'address',
  'adres': 'address',
  'apparantly': 'apparently',
  'appearently': 'apparently',
  'beleive': 'believe',
  'belive': 'believe',
  'buisness': 'business',
  'busness': 'business',
  'calender': 'calendar',
  'catagory': 'category',
  'catagories': 'categories',
  'commited': 'committed',
  'commitee': 'committee',
  'completly': 'completely',
  'concious': 'conscious',
  'conciousness': 'consciousness',
  'embarass': 'embarrass',
  'embarassed': 'embarrassed',
  'enviroment': 'environment',
  'enviromental': 'environmental',
  'explaination': 'explanation',
  'familar': 'familiar',
  'finaly': 'finally',
  'foriegn': 'foreign',
  'fourty': 'forty',
  'freind': 'friend',
  'goverment': 'government',
  'gaurd': 'guard',
  'happend': 'happened',
  'harrass': 'harass',
  'immeditately': 'immediately',
  'immediatly': 'immediately',
  'independant': 'independent',
  'intresting': 'interesting',
  'knowlege': 'knowledge',
  'liason': 'liaison',
  'libary': 'library',
  'lisence': 'license',
  'maintainance': 'maintenance',
  'millenium': 'millennium',
  'mispell': 'misspell',
  'mispelled': 'misspelled',
  'neccessary': 'necessary',
  'necessery': 'necessary',
  'noticable': 'noticeable',
  'occassion': 'occasion',
  'occassionally': 'occasionally',
  'orignal': 'original',
  'paralell': 'parallel',
  'parliment': 'parliament',
  'particulary': 'particularly',
  'percieve': 'perceive',
  'persistant': 'persistent',
  'posession': 'possession',
  'prefered': 'preferred',
  'priviledge': 'privilege',
  'probaly': 'probably',
  'profesional': 'professional',
  'programing': 'programming',
  'publically': 'publicly',
  'realy': 'really',
  'refered': 'referred',
  'relevent': 'relevant',
  'religous': 'religious',
  'rember': 'remember',
  'remeber': 'remember',
  'repitition': 'repetition',
  'resistence': 'resistance',
  'resturant': 'restaurant',
  'rythm': 'rhythm',
  'saftey': 'safety',
  'schedual': 'schedule',
  'seize': 'seize',
  'succesful': 'successful',
  'successfull': 'successful',
  'suprise': 'surprise',
  'suprised': 'surprised',
  'thier': 'their',
  'tommorow': 'tomorrow',
  'tommorrow': 'tomorrow',
  'tounge': 'tongue',
  'truely': 'truly',
  'untill': 'until',
  'unusuall': 'unusual',
  'usefull': 'useful',
  'vaccuum': 'vacuum',
  'vegatable': 'vegetable',
  'wether': 'whether',
  'wierd': 'weird',
  'writting': 'writing',
  // Common form-related words
  'submitt': 'submit',
  'submision': 'submission',
  'requried': 'required',
  'requred': 'required',
  'optinal': 'optional',
  'feild': 'field',
  'feilds': 'fields',
  'queston': 'question',
  'questoin': 'question',
  'anwser': 'answer',
  'anser': 'answer',
  'repsonse': 'response',
  'respone': 'response',
  'emial': 'email',
  'emali': 'email',
  'phoen': 'phone',
  'nmae': 'name',
  'naem': 'name',
  'titile': 'title',
  'tiel': 'title',
  'issuse': 'issue',
  'isues': 'issues',
  'isssue': 'issue',
  'problme': 'problem',
  'prolbem': 'problem',
  'detials': 'details',
  'deatils': 'details',
  'infromation': 'information',
  'informaiton': 'information',
  'contcat': 'contact',
  'conatct': 'contact',
  'messge': 'message',
  'messgae': 'message',
  'comemnt': 'comment',
  'commnet': 'comment',
  'feedabck': 'feedback',
  'feedbcak': 'feedback',
  'sugestion': 'suggestion',
  'suggesiton': 'suggestion',
  'preferance': 'preference',
  'preferecne': 'preference'
};

interface SpellCheckInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: 'input' | 'textarea';
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

interface Suggestion {
  word: string;
  correction: string;
  startIndex: number;
  endIndex: number;
}

export default function SpellCheckInput({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'input',
  rows = 3,
  disabled = false,
  autoFocus = false
}: SpellCheckInputProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Check for misspellings in the text
  const checkSpelling = useCallback((text: string): Suggestion | null => {
    const words = text.split(/\s+/);
    let currentIndex = 0;

    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');
      if (cleanWord && commonMisspellings[cleanWord]) {
        const startIndex = text.toLowerCase().indexOf(cleanWord, currentIndex);
        return {
          word: cleanWord,
          correction: commonMisspellings[cleanWord],
          startIndex,
          endIndex: startIndex + cleanWord.length
        };
      }
      currentIndex += word.length + 1;
    }
    return null;
  }, []);

  // Check spelling when value changes
  useEffect(() => {
    const found = checkSpelling(value);
    if (found) {
      setSuggestion(found);
      setShowSuggestion(true);
    } else {
      setSuggestion(null);
      setShowSuggestion(false);
    }
  }, [value, checkSpelling]);

  // Apply the correction
  const applySuggestion = () => {
    if (!suggestion) return;

    // Replace the misspelled word with the correction (case-preserving)
    const originalWord = value.substring(suggestion.startIndex, suggestion.endIndex);
    let correctedWord = suggestion.correction;

    // Preserve original case
    if (originalWord[0] === originalWord[0].toUpperCase()) {
      correctedWord = correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1);
    }
    if (originalWord === originalWord.toUpperCase()) {
      correctedWord = correctedWord.toUpperCase();
    }

    const newValue =
      value.substring(0, suggestion.startIndex) +
      correctedWord +
      value.substring(suggestion.endIndex);

    onChange(newValue);
    setShowSuggestion(false);
    setSuggestion(null);

    // Focus back on input
    inputRef.current?.focus();
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    setShowSuggestion(false);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestion(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commonProps = {
    ref: inputRef as any,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder,
    className,
    disabled,
    autoFocus,
    spellCheck: true
  };

  return (
    <div className="relative">
      {type === 'textarea' ? (
        <textarea {...commonProps} rows={rows} />
      ) : (
        <input {...commonProps} type="text" />
      )}

      {/* Spell check suggestion popup */}
      {showSuggestion && suggestion && (
        <div
          ref={suggestionRef}
          className="absolute left-0 top-full mt-1 z-50 bg-[#2a2b36] border border-slate-600 rounded-lg shadow-xl p-2 min-w-[200px]"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-slate-400">Did you mean:</span>
            <button
              onClick={dismissSuggestion}
              className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={applySuggestion}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-white bg-violet-600/20 hover:bg-violet-600/30 rounded-md transition-colors"
          >
            <Check className="w-4 h-4 text-violet-400" />
            <span>
              <span className="line-through text-slate-500 mr-2">{suggestion.word}</span>
              <span className="text-violet-400 font-medium">{suggestion.correction}</span>
            </span>
          </button>
          <p className="text-[10px] text-slate-500 mt-1 px-1">Click to apply correction</p>
        </div>
      )}
    </div>
  );
}
