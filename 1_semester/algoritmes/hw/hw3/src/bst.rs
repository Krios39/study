use std::collections::VecDeque;
use std::cmp::max;

pub struct BST<T> {
    pub root: Option<Box<Node<T>>>,
}

pub struct Node<T> {
    pub value: T,
    pub left: Option<Box<Node<T>>>,
    pub right: Option<Box<Node<T>>>,
}

impl<T: Ord> Node<T> {
    fn new(value: T) -> Self {
        Self { value, left: None, right: None }
    }
}

impl<T: Ord + std::fmt::Debug> BST<T> {
    pub fn new() -> Self {
        Self { root: None }
    }

    pub fn from_vec(items: Vec<T>) -> Self {
        let mut tree = BST::new();
        for item in items {
            tree.insert(item);
        }
        tree
    }

    pub fn insert(&mut self, value: T) {
        match self.root {
            Some(ref mut node) => Self::insert_recursive(node, value),
            None => self.root = Some(Box::new(Node::new(value))),
        }
    }

    fn insert_recursive(node: &mut Node<T>, value: T) {
        if value < node.value {
            match node.left {
                Some(ref mut left_node) => Self::insert_recursive(left_node, value),
                None => node.left = Some(Box::new(Node::new(value))),
            }
        } else if value > node.value {
            match node.right {
                Some(ref mut right_node) => Self::insert_recursive(right_node, value),
                None => node.right = Some(Box::new(Node::new(value))),
            }
        }
    }

    pub fn search(&self, value: &T) -> bool {
        Self::search_recursive(&self.root, value)
    }

    fn search_recursive(node_opt: &Option<Box<Node<T>>>, value: &T) -> bool {
        match node_opt {
            Some(node) => {
                if *value == node.value {
                    true
                } else if *value < node.value {
                    Self::search_recursive(&node.left, value)
                } else {
                    Self::search_recursive(&node.right, value)
                }
            }
            None => false,
        }
    }

    pub fn remove(&mut self, value: &T) {

        self.root = Self::remove_recursive(self.root.take(), value);
    }

    fn remove_recursive(node_opt: Option<Box<Node<T>>>, value: &T) -> Option<Box<Node<T>>> {
        let mut node = node_opt?; // Если пришел None, сразу возвращаем None

        if *value < node.value {
            node.left = Self::remove_recursive(node.left, value);
            Some(node)
        } else if *value > node.value {
            node.right = Self::remove_recursive(node.right, value);
            Some(node)
        } else {

            match (node.left.take(), node.right.take()) {
                (None, None) => None,
                (Some(left), None) => Some(left),
                (None, Some(right)) => Some(right),
                (Some(left), Some(right)) => {

                    let (mut min_node, new_right) = Self::remove_min(right);

                    min_node.left = Some(left);
                    min_node.right = new_right;
                    Some(min_node)
                }
            }
        }
    }


    fn remove_min(mut node: Box<Node<T>>) -> (Box<Node<T>>, Option<Box<Node<T>>>) {
        if let Some(left) = node.left.take() {
            let (min_node, new_left) = Self::remove_min(left);
            node.left = new_left;
            (min_node, Some(node))
        } else {
            let right = node.right.take();
            (node, right)
        }
    }

    pub fn print_compact(&self) {
        Self::print_rec(&self.root, 0);
        println!("-------------------");
    }

    fn print_rec(node: &Option<Box<Node<T>>>, depth: usize) {
        if let Some(n) = node {
            Self::print_rec(&n.right, depth + 1);

            println!("{}{:?}", "    ".repeat(depth), n.value);

            Self::print_rec(&n.left, depth + 1);
        }
    }
}



pub struct TreeAnalyzer<'a, T> {
    tree: &'a BST<T>,
}

impl<'a, T: Ord + std::fmt::Debug> TreeAnalyzer<'a, T> {
    pub fn new(tree: &'a BST<T>) -> Self {
        Self { tree }
    }

    pub fn count_nodes(&self) -> usize {
        Self::count_rec(&self.tree.root)
    }

    fn count_rec(node: &Option<Box<Node<T>>>) -> usize {
        match node {
            Some(n) => 1 + Self::count_rec(&n.left) + Self::count_rec(&n.right),
            None => 0,
        }
    }

    pub fn height(&self) -> usize {
        Self::height_rec(&self.tree.root)
    }

    fn height_rec(node: &Option<Box<Node<T>>>) -> usize {
        match node {
            Some(n) => 1 + max(Self::height_rec(&n.left), Self::height_rec(&n.right)),
            None => 0,
        }
    }

    pub fn depth_distribution(&self) -> Vec<usize> {
        let mut dist = Vec::new();
        if self.tree.root.is_none() { return dist; }

        let mut queue = VecDeque::new();
        // В очереди храним кортеж: (ссылка_на_узел, текущая_глубина)
        queue.push_back((self.tree.root.as_ref().unwrap(), 0));

        while let Some((node, depth)) = queue.pop_front() {
            if depth >= dist.len() {
                dist.push(0);
            }
            dist[depth] += 1;

            if let Some(left) = &node.left { queue.push_back((left, depth + 1)); }
            if let Some(right) = &node.right { queue.push_back((right, depth + 1)); }
        }
        dist
    }

    pub fn max_width(&self) -> usize {
        *self.depth_distribution().iter().max().unwrap_or(&0)
    }

    pub fn search_with_trace(&self, target: &T) -> bool {
        println!("Searching for {:?}:", target);
        let mut current = &self.tree.root;

        while let Some(node) = current {
            print!("{:?} ", node.value);
            if *target == node.value {
                println!("-> FOUND!");
                return true;
            } else if *target < node.value {
                print!("(left) -> ");
                current = &node.left;
            } else {
                print!("(right) -> ");
                current = &node.right;
            }
        }
        println!("-> NOT FOUND.");
        false
    }
}