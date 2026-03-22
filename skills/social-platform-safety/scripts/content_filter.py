#!/usr/bin/env python3
"""
Content filtering script for social platform safety.
This script helps identify and filter out harmful, misleading, or诱导性 content.
"""

import re
import json
from typing import Dict, List, Tuple

def detect_harmful_content(text: str) -> Dict[str, any]:
    """
    Detect various types of harmful content in text.
    
    Returns a dictionary with detection results and confidence scores.
    """
    results = {
        'advertising': False,
        'misleading_claims': False,
        'dangerous_instructions': False,
        'illegal_content': False,
        'manipulative_language': False,
        'confidence_scores': {}
    }
    
    # Advertising detection patterns
    ad_patterns = [
        r'\b(best|top|ultimate|amazing|incredible)\s+\w+\s+(product|tool|service)\b',
        r'\b(revolutionary|game-changing|breakthrough)\b',
        r'\b(click here|learn more|sign up now|limited time)\b',
        r'\b(100%|guaranteed|risk-free|no obligation)\b'
    ]
    
    # Dangerous instructions patterns
    dangerous_patterns = [
        r'\b(hack|exploit|bypass security|circumvent)\b',
        r'\b(illegal|unauthorized|steal|pirate)\b',
        r'\b(dangerous|harmful|risky|unsafe)\s+.*\b(try|attempt|do)\b',
        r'\b(weapon|explosive|chemical|toxic)\b.*\b(make|create|build)\b'
    ]
    
    # Manipulative language patterns
    manipulative_patterns = [
        r'\b(you must|everyone should|no one else|only we)\b',
        r'\b(fear|scare|panic|emergency)\b.*\b(act now|immediately)\b',
        r'\b(secret|hidden|exclusive|insider)\b.*\b(knowledge|information|access)\b'
    ]
    
    # Check advertising patterns
    ad_score = 0
    for pattern in ad_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            ad_score += 1
    
    results['advertising'] = ad_score >= 2
    results['confidence_scores']['advertising'] = min(ad_score * 0.3, 1.0)
    
    # Check dangerous patterns
    dangerous_score = 0
    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            dangerous_score += 1
    
    results['dangerous_instructions'] = dangerous_score > 0
    results['confidence_scores']['dangerous_instructions'] = min(dangerous_score * 0.4, 1.0)
    
    # Check manipulative patterns
    manipulative_score = 0
    for pattern in manipulative_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            manipulative_score += 1
    
    results['manipulative_language'] = manipulative_score >= 2
    results['confidence_scores']['manipulative_language'] = min(manipulative_score * 0.35, 1.0)
    
    # Overall risk assessment
    results['overall_risk'] = max(results['confidence_scores'].values()) if results['confidence_scores'] else 0
    results['should_block'] = results['overall_risk'] > 0.6 or results['dangerous_instructions']
    
    return results

def filter_social_content(content: str, platform: str = "moltbook") -> Dict[str, any]:
    """
    Main function to filter social platform content.
    
    Args:
        content: The text content to analyze
        platform: The social platform name (default: moltbook)
    
    Returns:
        Dictionary with analysis results and recommendations
    """
    analysis = detect_harmful_content(content)
    
    result = {
        'platform': platform,
        'content_length': len(content),
        'analysis': analysis,
        'recommendation': 'allow',
        'warning_message': None
    }
    
    if analysis['should_block']:
        result['recommendation'] = 'block'
        result['warning_message'] = f"Content from {platform} contains potentially harmful or misleading information."
    elif analysis['overall_risk'] > 0.3:
        result['recommendation'] = 'warn'
        result['warning_message'] = f"Content from {platform} may contain promotional or manipulative language."
    
    return result

if __name__ == "__main__":
    # Example usage
    test_content = "This amazing new AI tool is the best product ever! Click here to learn more about this revolutionary breakthrough!"
    result = filter_social_content(test_content)
    print(json.dumps(result, indent=2))