import yaml
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'weights.yaml')
DATASETS_PATH = os.path.join(os.path.dirname(__file__), 'datasets.yaml')

def load_weights_config():
    if not os.path.exists(CONFIG_PATH):
        # Default fallback if file is missing
        return {
            'dynamic_weights': {
                'alpha_congestion': 50.0,
                'beta_predictive': 20.0,
                'gamma_signal': 30.0,
                'delta_decay': 1.0
            },
            'signal_decay': {
                'lambda_rate': 0.005,
                'epsilon': 0.1
            }
        }
        
    with open(CONFIG_PATH, 'r') as f:
        return yaml.safe_load(f)

def load_datasets_config():
    if not os.path.exists(DATASETS_PATH):
        return {
            "active": "melbourne",
            "datasets": {
                "melbourne": {
                    "name": "Melbourne CBD",
                    "center": [144.965, -37.813],
                    "zoom": 14.5,
                    "default_origin": [144.9669, -37.8183],
                    "default_destination": [144.9646, -37.8098]
                }
            }
        }
    with open(DATASETS_PATH, 'r') as f:
        return yaml.safe_load(f)

WEIGHTS_CONFIG = load_weights_config()
DATASETS_CONFIG = load_datasets_config()
