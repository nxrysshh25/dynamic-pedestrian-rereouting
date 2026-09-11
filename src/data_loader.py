from src.config.loader import DATASETS_CONFIG
from src.data.melbourne_loader import load_melbourne_data
from src.data.vit_loader import load_vit_data

def load_data():
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    
    if active_dataset == "vit_vellore":
        return load_vit_data()
    else:
        return load_melbourne_data()
