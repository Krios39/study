use std::cmp::max;

#[derive(Clone)]
pub struct AVLNode<T> {
    pub value: T,
    pub height: isize,
    pub left: Option<Box<AVLNode<T>>>,
    pub right: Option<Box<AVLNode<T>>>,
}

impl<T: Ord + std::fmt::Debug> AVLNode<T> {
    pub fn new(value: T) -> Self {
        Self {
            value,
            height: 1,
            left: None,
            right: None,
        }
    }
}

pub struct AVLTree<T> {
    pub root: Option<Box<AVLNode<T>>>,
    pub ll_count: usize,
    pub rr_count: usize,
    pub lr_count: usize,
    pub rl_count: usize,
}

impl<T: Ord + std::fmt::Debug + Clone> AVLTree<T> {
    pub fn new() -> Self {
        Self {
            root: None,
            ll_count: 0,
            rr_count: 0,
            lr_count: 0,
            rl_count: 0,
        }
    }

    fn height(node: &Option<Box<AVLNode<T>>>) -> isize {
        node.as_ref().map_or(0, |n| n.height)
    }

    fn balance_factor(node: &Option<Box<AVLNode<T>>>) -> isize {
        node.as_ref().map_or(0, |n| Self::height(&n.left) - Self::height(&n.right))
    }

    fn update_height(node: &mut Box<AVLNode<T>>) {
        node.height = 1 + max(Self::height(&node.left), Self::height(&node.right));
    }

    pub fn insert_with_trace(&mut self, value: T, silent: bool) {
        if !silent {
            println!("Inserting: {:?}", value);
        }
        let root = self.root.take();
        self.root = self.insert_recursive(root, value, silent);

        if !silent {
            println!("  -> Tree Height: {}", Self::height(&self.root));
            let bst_ok = self.is_valid_bst(&self.root, None, None);
            let avl_ok = self.is_valid_avl(&self.root);
            println!("  -> Invariants | BST OK: {}, AVL OK: {}\n", bst_ok, avl_ok);
        }
    }

    fn insert_recursive(
        &mut self,
        node_opt: Option<Box<AVLNode<T>>>,
        value: T,
        silent: bool,
    ) -> Option<Box<AVLNode<T>>> {
        let mut node = match node_opt {
            Some(n) => n,
            None => return Some(Box::new(AVLNode::new(value))),
        };

        if value < node.value {
            node.left = self.insert_recursive(node.left, value, silent);
        } else if value > node.value {
            node.right = self.insert_recursive(node.right, value, silent);
        } else {
            return Some(node); // Дубликаты игнорируем
        }

        Self::update_height(&mut node);
        let balance = Self::balance_factor(&Some(node.clone()));

        // Балансировка
        if balance > 1 { // Left heavy
            if Self::balance_factor(&node.left) < 0 {
                // LR (Left-Right)
                self.lr_count += 1;
                if !silent { Self::trace_rotation("LR", &node); }
                let left = node.left.take().unwrap();
                node.left = Some(Self::rotate_left(left));
                node = Self::rotate_right(node);
                if !silent { Self::trace_after(&node); }
            } else {
                // LL (Left-Left)
                self.ll_count += 1;
                if !silent { Self::trace_rotation("LL", &node); }
                node = Self::rotate_right(node);
                if !silent { Self::trace_after(&node); }
            }
        } else if balance < -1 { // Right heavy
            if Self::balance_factor(&node.right) > 0 {
                // RL (Right-Left)
                self.rl_count += 1;
                if !silent { Self::trace_rotation("RL", &node); }
                let right = node.right.take().unwrap();
                node.right = Some(Self::rotate_right(right));
                node = Self::rotate_left(node);
                if !silent { Self::trace_after(&node); }
            } else {
                // RR (Right-Right)
                self.rr_count += 1;
                if !silent { Self::trace_rotation("RR", &node); }
                node = Self::rotate_left(node);
                if !silent { Self::trace_after(&node); }
            }
        }
        Some(node)
    }

    fn rotate_right(mut y: Box<AVLNode<T>>) -> Box<AVLNode<T>> {
        let mut x = y.left.take().unwrap();
        y.left = x.right.take();
        Self::update_height(&mut y);
        x.right = Some(y);
        Self::update_height(&mut x);
        x
    }

    fn rotate_left(mut x: Box<AVLNode<T>>) -> Box<AVLNode<T>> {
        let mut y = x.right.take().unwrap();
        x.right = y.left.take();
        Self::update_height(&mut x);
        y.left = Some(x);
        Self::update_height(&mut y);
        y
    }

    fn trace_rotation(rot_type: &str, node: &Box<AVLNode<T>>) {
        println!("  [!] {} Rebalance triggered at node {:?}", rot_type, node.value);
        println!("      Before: {}", Self::subtree_to_string(&Some(node.clone())));
    }

    fn trace_after(node: &Box<AVLNode<T>>) {
        println!("      After:  {}", Self::subtree_to_string(&Some(node.clone())));
    }

    fn subtree_to_string(node: &Option<Box<AVLNode<T>>>) -> String {
        match node {
            Some(n) => {
                let l = Self::subtree_to_string(&n.left);
                let r = Self::subtree_to_string(&n.right);
                if l == "-" && r == "-" { format!("{:?}", n.value) }
                else { format!("{:?}(L:{}, R:{})", n.value, l, r) }
            },
            None => "-".to_string()
        }
    }

    pub fn is_valid_bst(&self, node: &Option<Box<AVLNode<T>>>, min: Option<&T>, max: Option<&T>) -> bool {
        if let Some(n) = node {
            if let Some(min_val) = min { if n.value <= *min_val { return false; } }
            if let Some(max_val) = max { if n.value >= *max_val { return false; } }
            return self.is_valid_bst(&n.left, min, Some(&n.value)) && self.is_valid_bst(&n.right, Some(&n.value), max);
        }
        true
    }

    pub fn is_valid_avl(&self, node: &Option<Box<AVLNode<T>>>) -> bool {
        if let Some(n) = node {
            let balance = Self::balance_factor(node).abs();
            if balance > 1 { return false; }
            return self.is_valid_avl(&n.left) && self.is_valid_avl(&n.right);
        }
        true
    }

    pub fn get_total_rotations(&self) -> usize {
        self.ll_count + self.rr_count + (self.lr_count * 2) + (self.rl_count * 2)
    }

    pub fn mean_search_depth(&self) -> f64 {
        let (total_depth, count) = Self::depth_sum(&self.root, 1);
        if count == 0 { 0.0 } else { total_depth as f64 / count as f64 }
    }

    fn depth_sum(node: &Option<Box<AVLNode<T>>>, depth: usize) -> (usize, usize) {
        match node {
            Some(n) => {
                let (l_sum, l_count) = Self::depth_sum(&n.left, depth + 1);
                let (r_sum, r_count) = Self::depth_sum(&n.right, depth + 1);
                (depth + l_sum + r_sum, 1 + l_count + r_count)
            },
            None => (0, 0)
        }
    }
}