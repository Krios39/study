import json

from HW6_helpers import load_words, word_graph

words = load_words("../hw5/HW5_words.txt")
graph = word_graph(words)
print("Words:", len(words))
print("Neighbours of sport:", graph["sport"])

with open("HW6_word_graph.json", "w", encoding="ascii") as output:
    json.dump(graph, output)

with open("HW6_word_graph_100.json", "w", encoding="ascii") as output:
    json.dump(word_graph(words[:100]), output)
