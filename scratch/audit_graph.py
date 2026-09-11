import sys
import os
import networkx as nx
from collections import Counter

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.graph_manager import load_or_build_graph

def audit_graph():
    G = load_or_build_graph()
    
    attrs = {
        'has_stairs': Counter(),
        'wheelchair_accessible': Counter(),
        'incline_value': Counter(),
        'surface_type': Counter(),
        'smoothness_value': Counter(),
        'tactile_paving': Counter()
    }
    
    lengths = []
    
    for u, v, data in G.edges(data=True):
        lengths.append(data.get('length', 0))
        for key in attrs.keys():
            val = data.get(key)
            if hasattr(val, 'iloc'): # Pandas series
                val = val.iloc[0]
            val = str(val)
            attrs[key][val] += 1
            
    print(f"Total Edges: {G.number_of_edges()}")
    print(f"Min Length: {min(lengths):.2f}, Max Length: {max(lengths):.2f}, Avg Length: {sum(lengths)/len(lengths):.2f}")
    
    for key, counts in attrs.items():
        print(f"\n--- {key} ---")
        for k, v in counts.most_common(10):
            print(f"  {k}: {v}")

if __name__ == "__main__":
    audit_graph()
