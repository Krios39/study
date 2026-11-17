HADOOP_USER_CLASSPATH_FIRST=true HADOOP_CLASSPATH=build_orig hadoop org.apache.hadoop.examples.WordMedian -D mapreduce.job.reduces=3 in /tmp/o 2>&1 | grep -i "median is\|Exception"; ls /tmp/o
