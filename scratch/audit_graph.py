import sys
import os
import networkx as nx
from collections import Counter

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.graph_manager import load_or_build_graph

def audit_graph():
    G = load_or_build_graph()
    
    attrs = {
        'stairs': Counter(),
        'ramp': Counter(),
        'crossing': Counter(),
        'barrier': Counter(),
        'slope_percent': Counter(),
        'slope_status': Counter(),
        'subway': Counter(),
        'highway': Counter(),
        'surface': Counter()
    }
    
    lengths = []
    
    for u, v, data in G.edges(data=True):
        lengths.append(data.get('length', data.get('length_m', 0)))
        for key in attrs.keys():
            val = data.get(key)
            if hasattr(val, 'iloc'): # Pandas series
                val = val.iloc[0]
            val = str(val)
            attrs[key][val] += 1
            
    print(f"Total Nodes: {G.number_of_nodes()}")
    print(f"Total Edges: {G.number_of_edges()}")
    print(f"Min Length: {min(lengths):.2f}, Max Length: {max(lengths):.2f}, Avg Length: {sum(lengths)/len(lengths):.2f}")
    
    for key, counts in attrs.items():
        print(f"\n--- {key} ---")
        for k, v in counts.most_common(10):
            print(f"  {k}: {v}")

if __name__ == "__main__":
    audit_graph()
