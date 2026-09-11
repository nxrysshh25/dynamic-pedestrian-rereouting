# VIT Vellore Academic Block Dataset
    
## Purpose
A highly focused, clean, academic-block-only pedestrian routing dataset for Signal Decay algorithm tests.

## Geometry and Topology
- **Nodes**: 820
- **Edges**: 943
- **Academic Blocks Mapped**: 10
- **Stairs Mapped**: 7
- **Ramps Mapped**: 0
- **Connected Components**: 1
- **Isolated Nodes**: 0
- **Self Loops**: 0

## Data Constraints Enforced
- **Strict Scope**: Only academic blocks (SJT, TT, MB, etc.) are included. Hostels, mess halls, and irrelevant facilities are aggressively filtered out.
- **Topological Integrity**: Dead-end edges unrelated to the academic routing core were iteratively pruned.

## Validation Results
- **MB->GDN**: success
  - Nodes traversed: 19
  - Stairs used: 0
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)
- **GDN->TT**: success
  - Nodes traversed: 28
  - Stairs used: 2
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)
- **TT->SJT**: success
  - Nodes traversed: 25
  - Stairs used: 0
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)
- **SJT->SMV**: success
  - Nodes traversed: 41
  - Stairs used: 0
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)
- **SMV->CBMR**: success
  - Nodes traversed: 35
  - Stairs used: 0
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)
- **CBMR->CTS**: success
  - Nodes traversed: 53
  - Stairs used: 1
  - Accessible Alternative Exists: True
  - **Alternative Route Found**: True (Passes Signal Decay test requirement)

## Old vs New Comparison
**OLD (Full Campus)**:
- Buildings: 156 (includes non-academic noise)
- Nodes: 271
- Edges: 377
- Pruning: None (dead-ends retained)

**NEW (Academic Blocks Only)**:
- Buildings: Strictly limited to Academic Blocks.
- Graph Topology: Subgraph connecting exactly the specified blocks, dead-ends dynamically pruned.
- Testing: Alternative Path guarantees established.
