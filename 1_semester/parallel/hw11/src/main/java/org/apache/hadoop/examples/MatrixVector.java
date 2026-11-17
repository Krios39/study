package org.apache.hadoop.examples;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.FileSystem;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.DoubleWritable;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.util.GenericOptionsParser;

public class MatrixVector {

  public static class RowMapper
       extends Mapper<Object, Text, IntWritable, DoubleWritable> {

    private double[] vector;
    private final IntWritable row = new IntWritable();
    private final DoubleWritable product = new DoubleWritable();

    @Override
    protected void setup(Context context) {
      String[] parts = context.getConfiguration().get("vector_values").split(",");
      vector = new double[parts.length];
      for (int j = 0; j < parts.length; j++) {
        vector[j] = Double.parseDouble(parts[j]);
      }
    }

    @Override
    public void map(Object key, Text value, Context context
                    ) throws IOException, InterruptedException {
      String line = value.toString().trim();
      if (line.isEmpty()) {
        return;
      }
      String[] cells = line.split(",");
      if (cells.length - 1 != vector.length) {
        throw new IOException("row " + cells[0].trim() + " has " + (cells.length - 1)
            + " columns, vector has " + vector.length);
      }
      double sum = 0;
      for (int j = 1; j < cells.length; j++) {
        sum += Double.parseDouble(cells[j].trim()) * vector[j - 1];
      }
      row.set(Integer.parseInt(cells[0].trim()));
      product.set(sum);
      context.write(row, product);
    }
  }

  public static class SumReducer
       extends Reducer<IntWritable, DoubleWritable, IntWritable, DoubleWritable> {

    private final DoubleWritable result = new DoubleWritable();

    @Override
    public void reduce(IntWritable key, Iterable<DoubleWritable> values,
                       Context context) throws IOException, InterruptedException {
      double sum = 0;
      for (DoubleWritable v : values) {
        sum += v.get();
      }
      result.set(sum);
      context.write(key, result);
    }
  }

  static String readVector(Configuration conf, Path path) throws IOException {
    FileSystem fs = path.getFileSystem(conf);
    List<String> values = new ArrayList<String>();
    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(fs.open(path), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        for (String token : line.trim().split("[,\\s]+")) {
          if (!token.isEmpty()) {
            Double.parseDouble(token);
            values.add(token);
          }
        }
      }
    }
    StringBuilder joined = new StringBuilder();
    for (int j = 0; j < values.size(); j++) {
      if (j > 0) {
        joined.append(',');
      }
      joined.append(values.get(j));
    }
    return joined.toString();
  }

  public static void main(String[] args) throws Exception {
    org.apache.log4j.BasicConfigurator.configure();
    org.apache.log4j.Logger.getRootLogger().setLevel(org.apache.log4j.Level.INFO);
    Configuration conf = new Configuration();
    String[] otherArgs = new GenericOptionsParser(conf, args).getRemainingArgs();
    if (otherArgs.length != 3) {
      System.err.println("Usage: matrixvector <matrix_folder> <vector_file> <output>");
      System.exit(2);
    }
    conf.set("vector_values", readVector(conf, new Path(otherArgs[1])));
    Job job = Job.getInstance(conf, "matrix vector");
    job.setJarByClass(MatrixVector.class);
    job.setMapperClass(RowMapper.class);
    job.setCombinerClass(SumReducer.class);
    job.setReducerClass(SumReducer.class);
    job.setOutputKeyClass(IntWritable.class);
    job.setOutputValueClass(DoubleWritable.class);
    FileInputFormat.addInputPath(job, new Path(otherArgs[0]));
    FileOutputFormat.setOutputPath(job, new Path(otherArgs[2]));
    System.exit(job.waitForCompletion(true) ? 0 : 1);
  }
}
