HADOOP_USER_CLASSPATH_FIRST=true HADOOP_CLASSPATH=build hadoop org.apache.hadoop.examples.WordCount in /tmp/o 2>&1 | grep -E "Map output (records|bytes|materialized)|Combine (input|output)|Reduce (input|output|shuffle)"
cmp /tmp/o/part-r-00000 output_wordcount_clean/part-r-00000 && echo SAME
